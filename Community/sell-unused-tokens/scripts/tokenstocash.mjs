#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const VERSION = "2.0.0";
const DEFAULT_ORIGIN = "https://tokensto.cash";
const CONFIG_PATH = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "tokenstocash", "session.json");

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

class ApiError extends CliError {
  constructor(status, body, retryAfterSec) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.code = body?.code;
    this.retryAfterSec = retryAfterSec || body?.retryAfterSec;
  }
}

function origin() {
  const value = (process.env.TOKENSTOCASH_URL || DEFAULT_ORIGIN).replace(/\/$/, "");
  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new CliError("TOKENSTOCASH_URL must use HTTPS (localhost is allowed for development).", 2);
  }
  return url.toString().replace(/\/$/, "");
}

function output(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function safeTerminalText(value) {
  return String(value).replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, (character) =>
    character === "\n" || character === "\t" ? character : "?",
  );
}

function writeStderr(value) {
  process.stderr.write(safeTerminalText(value));
}

function loadSession() {
  try {
    const value = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    if (!value || typeof value.token !== "string" || !value.token.startsWith("ttc_agent.") || !/^0x[0-9a-f]{40}$/.test(value.wallet)) {
      throw new Error("invalid");
    }
    if (!Number.isSafeInteger(value.expiresAt) || value.expiresAt <= Date.now()) {
      throw new CliError(`Session expired. Run: node ${process.argv[1]} login`);
    }
    return value;
  } catch (error) {
    if (error instanceof CliError) throw error;
    throw new CliError(`Not paired. Open ${origin()}/agent, then run: node ${process.argv[1]} login`);
  }
}

function saveSession(session) {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  chmodSync(dirname(CONFIG_PATH), 0o700);
  writeFileSync(CONFIG_PATH, `${JSON.stringify(session, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  chmodSync(CONFIG_PATH, 0o600);
}

function hiddenPrompt(label) {
  if (!process.stdin.isTTY || !process.stderr.isTTY || process.platform === "win32") {
    throw new CliError("A macOS or Linux terminal is required so the credential can be entered without echoing.", 2);
  }
  writeStderr(label);
  const read = spawnSync(
    "sh",
    [
      "-c",
      "trap 'stty echo < /dev/tty' EXIT INT TERM; stty -echo < /dev/tty; IFS= read -r value < /dev/tty; stty echo < /dev/tty; trap - EXIT INT TERM; printf %s \"$value\"",
    ],
    { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] },
  );
  writeStderr("\n");
  if (read.status !== 0) throw new CliError("Could not read from the terminal.", 2);
  const value = read.stdout.trim();
  if (!value) throw new CliError("Nothing entered.", 2);
  return value;
}

async function api(path, init = {}, session) {
  const response = await fetch(`${origin()}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(session ? { authorization: `Bearer ${session.token}`, "x-wallet": session.wallet } : {}),
      ...init.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ApiError(response.status, body, Number.isFinite(retryAfter) ? retryAfter : undefined);
  }
  return body;
}

function parseOptions(argv) {
  const options = {};
  const positionals = [];
  for (let index = 0; index < argv.length; index++) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      positionals.push(item);
      continue;
    }
    const name = item.slice(2);
    if (name === "confirm-provider-terms") {
      options[name] = true;
      continue;
    }
    if (!["budget", "basis", "models", "base-url", "floor", "from", "until", "time-zone"].includes(name)) {
      throw new CliError(`Unknown option: ${item}`, 2);
    }
    const value = argv[++index];
    if (!value || value.startsWith("--")) throw new CliError(`Missing value for ${item}`, 2);
    options[name] = value;
  }
  return { options, positionals };
}

function finiteNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new CliError(`${label} must be a number.`, 2);
  return parsed;
}

function wait(seconds) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(seconds, 1), 25) * 1000));
}

async function login() {
  writeStderr(`Create a one-time pairing code at ${origin()}/agent. It expires after 10 minutes.\n`);
  const code = hiddenPrompt("Pairing code (hidden): ");
  const session = await api("/api/agent/exchange", { method: "POST", body: JSON.stringify({ code }) });
  saveSession(session);
  output({ ok: true, wallet: session.wallet, expiresAt: new Date(session.expiresAt).toISOString(), scope: "listing-only" });
}

async function providers() {
  const session = loadSession();
  output(await api("/api/agent/providers", {}, session));
}

async function status() {
  const session = loadSession();
  output(await api("/api/offers", {}, session));
}

function logout() {
  const existed = existsSync(CONFIG_PATH);
  rmSync(CONFIG_PATH, { force: true });
  output({ ok: true, removed: existed });
}

async function postListing(session, body) {
  const post = () => api("/api/offers", { method: "POST", body: JSON.stringify(body) }, session);
  let result;
  try {
    result = await post();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 429) await wait(error.retryAfterSec || 15);
    else if (![502, 503, 504].includes(error.status)) throw error;
    result = await post();
  }
  if (result.retryAfterSec && result.failed?.some((failure) => failure.model === body.models[0])) {
    await wait(result.retryAfterSec);
    result = await post();
  }
  return result;
}

async function sell(argv) {
  const { options, positionals } = parseOptions(argv);
  if (positionals.length !== 1) throw new CliError("Usage: tokenstocash sell <provider> [options]", 2);
  if (!options["confirm-provider-terms"]) {
    throw new CliError("Review the provider terms, then pass --confirm-provider-terms if resale or sharing is permitted.", 2);
  }
  const budget = finiteNumber(options.budget, "--budget");
  if (budget > 10_000) throw new CliError("--budget cannot exceed $10,000 per day.", 2);
  const session = loadSession();
  const catalog = await api("/api/agent/providers", {}, session);
  const provider = catalog.providers.find((candidate) => candidate.id === positionals[0]);
  if (!provider) throw new CliError(`Unknown provider '${positionals[0]}'. Run the providers command.`, 2);
  const baseUrl = options["base-url"] || provider.baseUrl;
  if (!baseUrl) throw new CliError("This provider requires --base-url with a Surplus-supported HTTPS endpoint.", 2);
  const basis = options.basis || provider.defaultBasis;
  if (!["allowance", "prepaid", "payg"].includes(basis)) throw new CliError("--basis must be allowance, prepaid, or payg.", 2);
  const floor = options.floor == null ? undefined : finiteNumber(options.floor, "--floor");
  if (floor != null && (floor < 0.02 || floor > 1.2)) throw new CliError("--floor must be between 0.02 and 1.2.", 2);
  if (Boolean(options.from) !== Boolean(options.until)) throw new CliError("Use --from and --until together.", 2);

  const apiKey = hiddenPrompt(`${provider.label} API key (hidden): `);
  writeStderr("Testing the credential and discovering models…\n");
  const connected = await api(
    "/api/provider/connect",
    {
      method: "POST",
      body: JSON.stringify({
        baseUrl,
        apiKey,
        picker: provider.id,
        providerTermsConfirmed: true,
        costBasis: basis,
        ...(floor == null ? {} : { floorMultiplier: floor }),
      }),
    },
    session,
  );
  const available = new Set(connected.models.map((model) => model.model));
  const requested = options.models
    ? [...new Set(options.models.split(",").map((model) => model.trim()).filter(Boolean))]
    : connected.recommendedModels;
  if (!requested?.length) {
    throw new CliError("No attainable text models were recommended. Review demand or name models explicitly with --models.");
  }
  if (requested.length > 8) throw new CliError("At most 8 models can be listed at once.", 2);
  const unknown = requested.filter((model) => !available.has(model));
  if (unknown.length) throw new CliError(`The provider did not return: ${unknown.join(", ")}`, 2);
  if (budget < requested.length * 0.5) {
    throw new CliError(`--budget must be at least $${(requested.length * 0.5).toFixed(2)} for ${requested.length} models.`, 2);
  }
  const capDailyUsd = Math.floor((budget / requested.length) * 10_000) / 10_000;
  const created = [];
  const skipped = [];
  const failed = [];
  for (const [index, model] of requested.entries()) {
    writeStderr(`[${index + 1}/${requested.length}] ${model}\n`);
    try {
      const result = await postListing(session, {
        providerId: provider.id,
        baseUrl,
        apiKey,
        models: [model],
        providerTermsConfirmed: true,
        costBasis: basis,
        ...(floor == null ? {} : { floorMultiplier: floor }),
        capDailyUsd,
        sellFrom: options.from || null,
        sellUntil: options.until || null,
        timeZone: options["time-zone"] || null,
      });
      created.push(...(result.created || []));
      skipped.push(...(result.skipped || []));
      failed.push(...(result.failed || []));
    } catch (error) {
      failed.push({ model, error: error instanceof Error ? error.message : "Listing failed", ...(error?.code ? { code: error.code } : {}) });
    }
  }
  output({
    ok: failed.length === 0,
    provider: provider.id,
    wallet: session.wallet,
    dailyBudgetUsd: budget,
    perModelDailyCapUsd: capDailyUsd,
    created,
    skipped,
    failed,
  });
  if (!created.length && !skipped.length) process.exitCode = 1;
}

function help() {
  process.stdout.write(`tokenstocash ${VERSION}\n\n`);
  process.stdout.write("Pair once in the browser; list from a local terminal without exposing provider keys to chat.\n\n");
  process.stdout.write("Commands:\n");
  process.stdout.write("  login                                      Exchange a one-time code from /agent\n");
  process.stdout.write("  providers                                  List supported providers\n");
  process.stdout.write("  sell <provider> --confirm-provider-terms   Probe and list recommended models\n");
  process.stdout.write("       --budget <usd> [--basis <basis>] [--models <id,id>] [--floor <multiplier>]\n");
  process.stdout.write("       [--base-url <url>] [--from <HH:MM> --until <HH:MM> --time-zone <zone>]\n");
  process.stdout.write("  status                                     Show this wallet's listings\n");
  process.stdout.write("  logout                                     Remove the local session\n\n");
  process.stdout.write("Provider keys and pairing codes are accepted only through hidden terminal prompts.\n");
}

async function main() {
  const [command, ...argv] = process.argv.slice(2);
  if (!command || ["help", "--help", "-h"].includes(command)) return help();
  if (["--version", "-v"].includes(command)) return process.stdout.write(`${VERSION}\n`);
  if (command === "login") return login();
  if (command === "providers") return providers();
  if (command === "status") return status();
  if (command === "logout") return logout();
  if (command === "sell") return sell(argv);
  throw new CliError(`Unknown command '${command}'. Run with --help.`, 2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    writeStderr(`${error instanceof Error ? error.message : "Unexpected error"}\n`);
    process.exitCode = error?.exitCode || 1;
  });
}
