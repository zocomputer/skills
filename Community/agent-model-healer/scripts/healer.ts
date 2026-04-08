#!/usr/bin/env bun
/**
 * Agent Model Healer v2.1
 *
 * Fully autonomous self-healing watchdog for Zo scheduled agents.
 * Zero AI model cost for orchestration — only probe calls use /zo/ask.
 * All agent management and notifications use direct MCP calls.
 *
 * Commands:
 *   auto        Full autonomous pipeline: probe → list → heal/restore → notify → heartbeat
 *   probe       Test all configured models, output health status
 *   diagnose    Show unhealthy models and active switches
 *   status      Show full healer state
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const CONFIG_PATH = resolve(SCRIPT_DIR, "../assets/fallback-chain.json");
const STATE_DIR = resolve(process.env.HOME || "/root", ".healer");
const STATE_PATH = resolve(STATE_DIR, "state.json");
const LOG_PATH = "/dev/shm/agent-model-healer.log";
const ZO_ASK_API = "https://api.zo.computer/zo/ask";
const ZO_MCP_API = "https://api.zo.computer/mcp";

type ProbeHealth = "healthy" | "degraded" | "unhealthy";

interface ProbeResult {
  model: string;
  healthy: boolean;
  health: ProbeHealth;
  latencyMs: number;
  error?: string;
  warning?: string;
  checkedAt: string;
}

interface SwitchRecord {
  agentId: string;
  agentTitle: string;
  originalModel: string;
  currentModel: string;
  switchedAt: string;
  reason: string;
}

interface HealerState {
  switches: SwitchRecord[];
  lastProbe: Record<string, ProbeResult>;
  lastRunAt: string;
  healCount: number;
  restoreCount: number;
  lastHeartbeatAt?: string;
}

interface FallbackConfig {
  healerAgentId?: string;
  healerConfig: { model: string; label: string; rule: string };
  probeConfig: {
    prompt: string;
    expectedSubstring: string;
    timeoutMs: number;
    retries: number;
    latencyThresholds: { degradedMs: number; slowMs: number };
  };
  fallbackChains: Record<string, { label: string; fallbacks: string[] }>;
  modelLabels: Record<string, string>;
}

interface AgentInfo {
  id: string;
  title: string;
  model: string;
  active: boolean;
}

function log(msg: string) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}\n`;
  process.stderr.write(line);
  try {
    const existing = existsSync(LOG_PATH) ? readFileSync(LOG_PATH, "utf-8") : "";
    const lines = existing.split("\n");
    const trimmed = lines.length > 500 ? lines.slice(-400).join("\n") : existing;
    writeFileSync(LOG_PATH, trimmed + line);
  } catch {}
}

function getAuthToken(): string {
  const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!token) throw new Error("ZO_CLIENT_IDENTITY_TOKEN not set");
  return token;
}

function loadConfig(): FallbackConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

function loadState(): HealerState {
  if (!existsSync(STATE_PATH)) {
    return { switches: [], lastProbe: {}, lastRunAt: "", healCount: 0, restoreCount: 0 };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf-8"));
}

function saveState(state: HealerState) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function getModelLabel(model: string, config: FallbackConfig): string {
  return config.modelLabels[model] || model;
}

// ── MCP Direct Calls (zero model cost) ──────────────────────────────

async function mcpCall(toolName: string, args: Record<string, any>): Promise<any> {
  const token = getAuthToken();
  const resp = await fetch(ZO_MCP_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const data = await resp.json() as any;
  if (data.error) {
    throw new Error(`MCP ${toolName} failed: ${data.error.message}`);
  }
  return data.result?.content?.[0]?.text || "";
}

async function mcpListAgents(): Promise<AgentInfo[]> {
  log("Fetching agents via MCP list_agents...");
  const raw = await mcpCall("list_agents", {});
  return parseAgents(raw);
}

async function mcpEditAgent(agentId: string, model: string): Promise<string> {
  log(`MCP edit_agent: ${agentId} → ${model}`);
  return await mcpCall("edit_agent", { agent_id: agentId, model });
}

async function mcpSendEmail(subject: string, body: string): Promise<void> {
  log(`Sending notification email: ${subject}`);
  try {
    await mcpCall("send_email_to_user", { subject, body });
  } catch (err: any) {
    log(`Email send failed: ${err.message}`);
  }
}

// ── Probe (uses /zo/ask) ────────────────────────────────────────────

function classifyLatency(ms: number, thresholds: { degradedMs: number; slowMs: number }): { health: ProbeHealth; warning?: string } {
  if (ms >= thresholds.slowMs) return { health: "degraded", warning: `Slow response: ${ms}ms (threshold: ${thresholds.slowMs}ms)` };
  if (ms >= thresholds.degradedMs) return { health: "degraded", warning: `Elevated latency: ${ms}ms (threshold: ${thresholds.degradedMs}ms)` };
  return { health: "healthy" };
}

function parseBalanceFromError(body: string): string | undefined {
  const balanceMatch = body.match(/can only afford (\d+)/i);
  const requestedMatch = body.match(/requested up to (\d+)/i);
  if (balanceMatch) {
    const remaining = balanceMatch[1];
    const requested = requestedMatch?.[1] || "unknown";
    return `Remaining balance: ${remaining} tokens (requested: ${requested})`;
  }
  const creditMatch = body.match(/requires more credits/i);
  if (creditMatch) return "Provider reports insufficient credits";
  return undefined;
}

async function probeModel(model: string, config: FallbackConfig): Promise<ProbeResult> {
  const token = getAuthToken();
  const { prompt, expectedSubstring, timeoutMs, retries, latencyThresholds } = config.probeConfig;
  let lastError = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const resp = await fetch(ZO_ASK_API, {
        method: "POST",
        headers: {
          authorization: token,
          "content-type": "application/json",
        },
        body: JSON.stringify({ input: prompt, model_name: model }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - start;

      if (resp.ok) {
        const data = await resp.json() as any;
        const output: string = (data.output || "").toString();

        if (!output || output.trim().length === 0) {
          return {
            model, healthy: false, health: "unhealthy", latencyMs,
            error: "Empty response — model returned no output",
            checkedAt: new Date().toISOString(),
          };
        }

        if (expectedSubstring && !output.toLowerCase().includes(expectedSubstring.toLowerCase())) {
          const { health, warning: latWarn } = classifyLatency(latencyMs, latencyThresholds);
          return {
            model, healthy: true, health: "degraded", latencyMs,
            warning: `Output validation failed: expected "${expectedSubstring}" not found. ${latWarn || ""}`.trim(),
            checkedAt: new Date().toISOString(),
          };
        }

        const { health, warning } = classifyLatency(latencyMs, latencyThresholds);
        return { model, healthy: true, health, latencyMs, warning, checkedAt: new Date().toISOString() };

      } else {
        const body = await resp.text().catch(() => "");
        const balanceInfo = parseBalanceFromError(body);
        lastError = `HTTP ${resp.status}: ${body.slice(0, 300)}`;
        if (balanceInfo) lastError += ` [${balanceInfo}]`;

        if (resp.status >= 400) {
          return {
            model, healthy: false, health: "unhealthy",
            latencyMs: Date.now() - start,
            error: lastError, checkedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
      lastError = err.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : err.message;
    }
  }

  return { model, healthy: false, health: "unhealthy", latencyMs: 0, error: lastError, checkedAt: new Date().toISOString() };
}

// ── Agent Parsing ───────────────────────────────────────────────────

function parseAgents(raw: string): AgentInfo[] {
  const agents: AgentInfo[] = [];
  const entries = raw.split(/(?=id=')/);
  for (const entry of entries) {
    const idMatch = /id='([^']+)'/.exec(entry);
    const titleMatch = /title='([^']+)'/.exec(entry);
    const modelMatch = /model='([^']+)'/.exec(entry);
    const activeMatch = /active=(True|False)/.exec(entry);
    if (idMatch && modelMatch) {
      agents.push({
        id: idMatch[1],
        title: titleMatch?.[1] || "Untitled",
        model: modelMatch[1],
        active: activeMatch?.[1] !== "False",
      });
    }
  }
  return agents;
}

// ── Self-exclusion ──────────────────────────────────────────────────

const HEALER_TITLE_PATTERN = /model healer/i;

function isHealerAgent(agent: AgentInfo, config: FallbackConfig): boolean {
  if (config.healerAgentId && agent.id === config.healerAgentId) return true;
  if (HEALER_TITLE_PATTERN.test(agent.title)) return true;
  return false;
}

// ── Heartbeat ───────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function maybeSendHeartbeat(state: HealerState, config: FallbackConfig) {
  const now = Date.now();
  const lastBeat = state.lastHeartbeatAt ? new Date(state.lastHeartbeatAt).getTime() : 0;
  if (now - lastBeat < HEARTBEAT_INTERVAL_MS) return;

  const probes = Object.entries(state.lastProbe);
  const healthy = probes.filter(([, p]) => p.healthy && p.health === "healthy").length;
  const degraded = probes.filter(([, p]) => p.healthy && p.health === "degraded").length;
  const unhealthy = probes.filter(([, p]) => !p.healthy).length;
  const onFallback = state.switches.length;

  const subject = `💓 Model Healer Heartbeat — ${healthy}✅ ${degraded}⚠️ ${unhealthy}❌`;
  const body = `
<p>Daily heartbeat from the Agent Model Healer. If you stop receiving this, the healer or Zo platform is down.</p>
<p><strong>Models:</strong> ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy</p>
<p><strong>Agents on fallback:</strong> ${onFallback}</p>
<p><strong>Lifetime:</strong> ${state.healCount} heals, ${state.restoreCount} restores</p>
<p><em>— Agent Model Healer (heartbeat, every 24h)</em></p>
`.trim();

  await mcpSendEmail(subject, body);
  state.lastHeartbeatAt = new Date().toISOString();
  log("Heartbeat email sent.");
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdProbe() {
  const config = loadConfig();
  const state = loadState();
  const uniqueModels = new Set<string>(Object.keys(config.fallbackChains));

  log(`Probing ${uniqueModels.size} models...`);
  const results: ProbeResult[] = [];

  for (const model of uniqueModels) {
    log(`  Probing ${getModelLabel(model, config)}...`);
    const result = await probeModel(model, config);
    results.push(result);
    state.lastProbe[model] = result;
    const icon = result.health === "healthy" ? "✅" : result.health === "degraded" ? "⚠️" : "❌";
    const detail = result.error || result.warning || "";
    const status = `${icon} ${result.health.toUpperCase()}${detail ? `: ${detail}` : ""}`;
    log(`  ${getModelLabel(model, config)}: ${status} (${result.latencyMs}ms)`);
  }

  state.lastRunAt = new Date().toISOString();
  saveState(state);
  console.log(JSON.stringify({ command: "probe", results }, null, 2));
}

async function cmdDiagnose() {
  const config = loadConfig();
  const state = loadState();
  const unhealthyModels = Object.entries(state.lastProbe)
    .filter(([, p]) => !p.healthy)
    .map(([model, p]) => ({
      model, label: getModelLabel(model, config), error: p.error, lastChecked: p.checkedAt,
    }));

  console.log(JSON.stringify({
    command: "diagnose", unhealthyModels,
    activeSwitches: state.switches.length, lastRunAt: state.lastRunAt,
  }, null, 2));
}

async function cmdStatus() {
  const config = loadConfig();
  const state = loadState();

  const unhealthy = Object.entries(state.lastProbe)
    .filter(([, p]) => !p.healthy)
    .map(([model, p]) => ({ model, label: getModelLabel(model, config), health: p.health, error: p.error, checkedAt: p.checkedAt }));

  const degraded = Object.entries(state.lastProbe)
    .filter(([, p]) => p.healthy && p.health === "degraded")
    .map(([model, p]) => ({ model, label: getModelLabel(model, config), warning: p.warning, latencyMs: p.latencyMs, checkedAt: p.checkedAt }));

  const healthy = Object.entries(state.lastProbe)
    .filter(([, p]) => p.healthy && p.health === "healthy")
    .map(([model, p]) => ({ model, label: getModelLabel(model, config), latencyMs: p.latencyMs, checkedAt: p.checkedAt }));

  console.log(JSON.stringify({
    command: "status",
    lastRunAt: state.lastRunAt,
    totalHeals: state.healCount,
    totalRestores: state.restoreCount,
    activeSwitches: state.switches.map((s) => ({
      agentId: s.agentId, agentTitle: s.agentTitle,
      original: getModelLabel(s.originalModel, config),
      current: getModelLabel(s.currentModel, config),
      switchedAt: s.switchedAt, reason: s.reason,
    })),
    unhealthyModels: unhealthy,
    degradedModels: degraded,
    healthyModels: healthy,
  }, null, 2));
}

/**
 * Fully autonomous pipeline — designed for scheduled agent execution.
 * Zero AI model cost for orchestration. Only probes use /zo/ask.
 */
async function cmdAuto() {
  log("=== Healer Auto Run ===");
  const config = loadConfig();
  const state = loadState();

  // Step 1: Probe all models
  const uniqueModels = new Set<string>(Object.keys(config.fallbackChains));
  for (const sw of state.switches) uniqueModels.add(sw.originalModel);

  log(`Probing ${uniqueModels.size} models...`);
  for (const model of uniqueModels) {
    const result = await probeModel(model, config);
    state.lastProbe[model] = result;
    const icon = result.health === "healthy" ? "✅" : result.health === "degraded" ? "⚠️" : "❌";
    const detail = result.error || result.warning || "";
    log(`  ${icon} ${getModelLabel(model, config)} (${result.latencyMs}ms)${detail ? ` — ${detail}` : ""}`);
  }
  state.lastRunAt = new Date().toISOString();
  saveState(state);

  const unhealthy = Object.entries(state.lastProbe).filter(([, p]) => !p.healthy);

  if (unhealthy.length === 0 && state.switches.length === 0) {
    log("All models healthy. No switches active. Nothing to do.");
    await maybeSendHeartbeat(state, config);
    saveState(state);
    console.log(JSON.stringify({ phase: "complete", healActions: [], restoreActions: [], summary: "All healthy." }));
    return;
  }

  // Step 2: Fetch agents via direct MCP (zero model cost)
  let agents: AgentInfo[];
  try {
    agents = await mcpListAgents();
  } catch (err: any) {
    log(`Failed to list agents: ${err.message}`);
    console.log(JSON.stringify({ phase: "error", error: err.message }));
    return;
  }
  log(`Fetched ${agents.length} agents.`);

  const unhealthySet = new Set(unhealthy.map(([m]) => m));
  const healActions: Array<{ agentId: string; agentTitle: string; from: string; to: string; reason: string }> = [];
  const restoreActions: Array<{ agentId: string; agentTitle: string; from: string; to: string }> = [];

  // Step 3: Heal — switch agents on unhealthy models
  for (const agent of agents) {
    if (!agent.active) continue;
    // WATCHMEN INDEPENDENCE RULE: Never heal yourself
    if (isHealerAgent(agent, config)) {
      log(`Skipping self: ${agent.title} (${agent.id})`);
      continue;
    }
    if (state.switches.find((s) => s.agentId === agent.id)) continue;
    if (!unhealthySet.has(agent.model)) continue;

    const chain = config.fallbackChains[agent.model];
    if (!chain) { log(`No fallback chain for ${agent.model} — skipping ${agent.title}`); continue; }

    let targetModel: string | null = null;
    for (const fb of chain.fallbacks) {
      const probe = state.lastProbe[fb];
      if (!probe) {
        const result = await probeModel(fb, config);
        state.lastProbe[fb] = result;
        if (result.healthy) { targetModel = fb; break; }
      } else if (probe.healthy) { targetModel = fb; break; }
    }
    if (!targetModel) targetModel = "zo:smart";

    try {
      await mcpEditAgent(agent.id, targetModel);
      healActions.push({
        agentId: agent.id, agentTitle: agent.title,
        from: getModelLabel(agent.model, config),
        to: getModelLabel(targetModel, config),
        reason: state.lastProbe[agent.model]?.error || "unhealthy",
      });
      state.switches.push({
        agentId: agent.id, agentTitle: agent.title,
        originalModel: agent.model, currentModel: targetModel,
        switchedAt: new Date().toISOString(),
        reason: state.lastProbe[agent.model]?.error || "unhealthy",
      });
      state.healCount++;
      log(`HEALED: ${agent.title} → ${getModelLabel(targetModel, config)}`);
    } catch (err: any) {
      log(`Failed to switch ${agent.title}: ${err.message}`);
    }
  }

  // Step 4: Restore — check if original models recovered
  const remaining: SwitchRecord[] = [];
  for (const sw of state.switches) {
    if (healActions.find((a) => a.agentId === sw.agentId)) { remaining.push(sw); continue; }

    const probe = state.lastProbe[sw.originalModel];
    if (probe?.healthy) {
      try {
        await mcpEditAgent(sw.agentId, sw.originalModel);
        restoreActions.push({
          agentId: sw.agentId, agentTitle: sw.agentTitle,
          from: getModelLabel(sw.currentModel, config),
          to: getModelLabel(sw.originalModel, config),
        });
        state.restoreCount++;
        log(`RESTORED: ${sw.agentTitle} → ${getModelLabel(sw.originalModel, config)}`);
      } catch (err: any) {
        log(`Failed to restore ${sw.agentTitle}: ${err.message}`);
        remaining.push(sw);
      }
    } else {
      remaining.push(sw);
    }
  }
  state.switches = remaining;
  saveState(state);

  // Step 5: Notify via email (only if actions taken)
  if (healActions.length > 0 || restoreActions.length > 0) {
    const switchRows = healActions.map((a) =>
      `<tr><td>${a.agentTitle}</td><td>${a.from}</td><td>→</td><td>${a.to}</td><td>${a.reason.slice(0, 80)}</td></tr>`
    ).join("\n");
    const restoreRows = restoreActions.map((a) =>
      `<tr><td>${a.agentTitle}</td><td>${a.from}</td><td>→</td><td>${a.to}</td><td>Model recovered</td></tr>`
    ).join("\n");

    const subject = `⚕️ Model Healer — ${healActions.length} switch(es), ${restoreActions.length} restore(s)`;
    const body = `
<h2>Agent Model Healer Report</h2>
<p><strong>Time:</strong> ${new Date().toISOString()}</p>
<p><strong>Unhealthy models:</strong> ${unhealthy.map(([m, p]) => `${getModelLabel(m, config)} (${p.error?.slice(0, 60)})`).join(", ")}</p>
${healActions.length > 0 ? `
<h3>🔄 Switches</h3>
<table border="1" cellpadding="4" cellspacing="0">
<tr><th>Agent</th><th>From</th><th></th><th>To</th><th>Reason</th></tr>
${switchRows}
</table>` : ""}
${restoreActions.length > 0 ? `
<h3>✅ Restores</h3>
<table border="1" cellpadding="4" cellspacing="0">
<tr><th>Agent</th><th>From</th><th></th><th>To</th><th>Reason</th></tr>
${restoreRows}
</table>` : ""}
<p><strong>Still on fallback:</strong> ${remaining.length} agent(s)</p>
<p><em>— Agent Model Healer</em></p>
`.trim();

    await mcpSendEmail(subject, body);
  }

  // Step 6: Daily heartbeat
  await maybeSendHeartbeat(state, config);
  saveState(state);

  const summary = `${healActions.length} switch(es), ${restoreActions.length} restore(s). ${remaining.length} still on fallback.`;
  log(`Run complete: ${summary}`);
  console.log(JSON.stringify({ phase: "complete", healActions, restoreActions, summary }));
}

// ── CLI ─────────────────────────────────────────────────────────────
const [cmd] = process.argv.slice(2);

switch (cmd) {
  case "probe": await cmdProbe(); break;
  case "diagnose": await cmdDiagnose(); break;
  case "status": await cmdStatus(); break;
  case "auto": await cmdAuto(); break;
  default:
    console.log(`Agent Model Healer v2.1

Commands:
  auto               Full autonomous pipeline (for scheduled agent)
  probe              Test all configured models, output health status
  diagnose           Show unhealthy models and active switches
  status             Show full healer state

Pipeline (auto):
  1. Probes all models via /zo/ask (minimal tokens)
  2. Lists agents via direct MCP (zero cost)
  3. Switches unhealthy agents to fallbacks (zero cost)
  4. Restores agents when original models recover
  5. Sends email notification when actions taken
  6. Sends daily heartbeat email

State: ${STATE_PATH}
Config: ${CONFIG_PATH}
Logs: ${LOG_PATH}`);
}
