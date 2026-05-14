#!/usr/bin/env bun
/**
 * Full installer for AI Assistant Voice on any Zo Computer.
 *
 * Usage:
 *   bun deploy-tts-endpoint.ts                        # Deploy TTS only (ElevenLabs)
 *   bun deploy-tts-endpoint.ts --backend openai       # Deploy TTS only (OpenAI)
 *   bun deploy-tts-endpoint.ts --backend edge         # Deploy TTS only (edge-tts)
 *   bun deploy-tts-endpoint.ts --deploy-all           # Deploy all routes + PWA page
 *   bun deploy-tts-endpoint.ts --deploy-all --backend openai
 *   bun deploy-tts-endpoint.ts --deploy-all \
 *       --name "Aria" \
 *       --path "/aria" \
 *       --persona-id "your-persona-uuid" \
 *       --default-voice "shimmer" \
 *       --mcp-token-secret "ARIA_MCP_TOKEN"
 *   bun deploy-tts-endpoint.ts --host myhandle.zo.space
 *
 * Routes deployed (slug = lowercased --name, defaults to "voice"):
 *   /api/tts                  — TTS proxy (keeps API key server-side)
 *   /api/<slug>-ask           — Zo ask proxy (ZO_ASK_TOKEN secret required)
 *   /api/<slug>-bootstrap     — HMAC session-token issuer (24h TTL)
 *   /api/<slug>-mcp           — JSON-RPC 2.0 MCP server exposing Zo tools
 *   /api/<slug>-personas      — Dynamic persona catalog (list_personas MCP)
 *   /api/realtime-session     — OpenAI Realtime session token (OPENAI_API_KEY required)
 *   /<path>                   — The voice PWA page  (--deploy-all only)
 *
 * One-time prerequisites:
 *   1. ZO_CLIENT_IDENTITY_TOKEN — auto-available on Zo server
 *   2. ZO_ASK_TOKEN in Zo Secrets — Settings > Advanced > Access Tokens → add as secret
 *   3. TTS secret:
 *        ElevenLabs: ELEVENLABS_API_KEY
 *        OpenAI:     OPENAI_API_KEY
 *        edge-tts:   none (run setup-edge-tts.sh once first)
 *   4. OPENAI_API_KEY — only if you want the GPT Realtime mode
 */

import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS    = join(__dirname, "../assets");

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const deployAll    = args.includes("--deploy-all");
const backend      = (flag("--backend") ?? "elevenlabs").toLowerCase();
const rawHost      = flag("--host") ?? process.env.ZO_SPACE_HOST ?? "";
const assistName   = flag("--name") ?? "My Assistant";
const pagePath     = flag("--path") ?? "/ai-assistant-voice";
const personaId    = flag("--persona-id") ?? "";
const defaultVoice = flag("--default-voice") ?? "alloy";

// Env-var name holding the shared MCP token. Defaults to the generic
// MCP_SHARED_TOKEN so a freshly cloned repo doesn't bake any one user's
// assistant name into the secret. Pass --mcp-token-secret to override
// (e.g. --mcp-token-secret "ARIA_MCP_TOKEN").
const rawTokenSecret = flag("--mcp-token-secret") ?? "MCP_SHARED_TOKEN";
const mcpTokenEnv = rawTokenSecret.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
if (!/^[A-Z_][A-Z0-9_]*$/.test(mcpTokenEnv)) {
  console.error(`❌  Invalid --mcp-token-secret "${rawTokenSecret}". Must match /^[A-Z_][A-Z0-9_]*$/ after upper-casing.`);
  process.exit(1);
}

// Derive handle from env or host arg
const ZO_HANDLE    = rawHost
  ? rawHost.replace(/^https?:\/\//, "").replace(".zo.space", "")
  : (process.env.ZO_HANDLE ?? "");

if (!ZO_HANDLE && !process.env.ZO_CLIENT_IDENTITY_TOKEN) {
  console.error("❌  Could not determine Zo handle. Pass --host yourhandle.zo.space");
  process.exit(1);
}

const ZO_SPACE_HOST = `https://${ZO_HANDLE}.zo.space`;

// Slug derived from --name. Used for route paths (/api/<slug>-*) and as
// MCP server_label. Falls back to "voice" if --name produces an empty slug.
const assistSlug = (assistName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "voice");

// One central substituter — applied to every route file before deploy so
// every fork ends up with the host user's name, host, and default persona.
function substitutePlaceholders(code: string): string {
  return code
    .replace(/\{\{ZO_HOST\}\}/g,            ZO_SPACE_HOST)
    .replace(/\{\{ASSISTANT_NAME\}\}/g,     assistName)
    .replace(/\{\{ASSISTANT_SLUG\}\}/g,     assistSlug)
    .replace(/\{\{PAGE_PATH\}\}/g,          pagePath)
    .replace(/\{\{DEFAULT_PERSONA_ID\}\}/g, personaId)
    .replace(/\{\{DEFAULT_VOICE\}\}/g,      defaultVoice)
    .replace(/\{\{MCP_TOKEN_ENV\}\}/g,      mcpTokenEnv);
}

// ─── Backend config ───────────────────────────────────────────────────────────
const BACKENDS: Record<string, { file: string; secret?: string }> = {
  elevenlabs: { file: "tts-route.ts",        secret: "ELEVENLABS_API_KEY" },
  openai:     { file: "tts-route-openai.ts", secret: "OPENAI_API_KEY" },
  edge:       { file: "tts-route-edge.ts" },
};

const cfg = BACKENDS[backend];
if (!cfg) {
  console.error(`❌  Unknown backend "${backend}". Choose: elevenlabs | openai | edge`);
  process.exit(1);
}

const IDENTITY_TOKEN = process.env.ZO_CLIENT_IDENTITY_TOKEN;
if (!IDENTITY_TOKEN) {
  console.error("❌  ZO_CLIENT_IDENTITY_TOKEN not set. Run this on your Zo server.");
  process.exit(1);
}

// ─── Zo API helper ────────────────────────────────────────────────────────────
async function deployRoute(
  label: string,
  path: string,
  code: string,
  routeType: "api" | "page" = "api",
): Promise<void> {
  console.log(`📡  Deploying ${path} [${label}] …`);

  const instruction = routeType === "page"
    ? `Create (or overwrite) a zo.space PAGE route at path \`${path}\` with route_type=page and public=false. Use EXACTLY this TypeScript/TSX code:\n\`\`\`tsx\n${code}\n\`\`\`\nAfter creating call get_space_errors(). Reply: OK or ERROR:<reason>`
    : `Create (or overwrite) a zo.space API route at path \`${path}\` with route_type=api and public=true. Use EXACTLY this TypeScript code:\n\`\`\`typescript\n${code}\n\`\`\`\nAfter creating call get_space_errors(). Reply: OK or ERROR:<reason>`;

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: IDENTITY_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: instruction,
      model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
    }),
  });

  if (!res.ok) throw new Error(`Zo API error: ${res.status} ${await res.text()}`);

  const data = await res.json() as { output: string };
  const output = (data.output ?? "").trim();

  if (output.startsWith("ERROR")) throw new Error(`Deploy failed: ${output}`);

  console.log(`✅  ${path} → ${ZO_SPACE_HOST}${path}`);
}

// ─── Deploy /api/tts ──────────────────────────────────────────────────────────
const ttsCode = substitutePlaceholders(readFileSync(join(ASSETS, cfg.file), "utf8"));
if (cfg.secret) console.log(`    ℹ️   Requires secret: ${cfg.secret} (Settings > Advanced)`);

try {
  await deployRoute(backend, "/api/tts", ttsCode);
} catch (err) {
  console.error("❌ ", err);
  process.exit(1);
}

// ─── Deploy remaining routes (--deploy-all) ───────────────────────────────────
if (deployAll) {
  // /api/<slug>-ask
  const askCode = substitutePlaceholders(readFileSync(join(ASSETS, "ai-ask-route.ts"), "utf8"));
  console.log("    ℹ️   Requires secret: ZO_ASK_TOKEN (Settings > Advanced > Access Tokens → Secrets)");
  try {
    await deployRoute(`${assistSlug}-ask`, `/api/${assistSlug}-ask`, askCode);
  } catch (err) {
    console.error("❌ ", err);
    process.exit(1);
  }

  // /api/<slug>-bootstrap — HMAC token issuer for realtime-session auth
  const bootstrapCode = substitutePlaceholders(readFileSync(join(ASSETS, "alaric-bootstrap-route.ts"), "utf8"));
  console.log("    ℹ️   Requires secret: ZO_ASK_TOKEN (HMAC secret for 24h session tokens)");
  try {
    await deployRoute(`${assistSlug}-bootstrap`, `/api/${assistSlug}-bootstrap`, bootstrapCode);
  } catch (err) {
    console.error(`⚠️   /api/${assistSlug}-bootstrap failed (non-fatal — Realtime auth chain breaks):`, err);
  }

  // /api/realtime-session — fixed name (the OpenAI Realtime token endpoint)
  const rtCode = substitutePlaceholders(readFileSync(join(ASSETS, "realtime-session-route.ts"), "utf8"));
  console.log("    ℹ️   Requires secret: OPENAI_API_KEY (for Realtime mode)");
  try {
    await deployRoute("realtime-session", "/api/realtime-session", rtCode);
  } catch (err) {
    console.error("⚠️   /api/realtime-session failed (non-fatal — Realtime mode won't work):", err);
  }

  // /api/<slug>-mcp — JSON-RPC 2.0 MCP server (v3.0 native MCP wiring)
  const mcpCode = substitutePlaceholders(readFileSync(join(ASSETS, "alaric-mcp-route.ts"), "utf8"));
  console.log(`    ℹ️   Requires secrets: ZO_API_KEY, ${mcpTokenEnv} (generate with \`openssl rand -hex 32\`)`);
  try {
    await deployRoute(`${assistSlug}-mcp`, `/api/${assistSlug}-mcp`, mcpCode);
  } catch (err) {
    console.error(`⚠️   /api/${assistSlug}-mcp failed (non-fatal — Realtime tool calls won't work):`, err);
  }

  // /api/<slug>-personas — dynamic catalog from list_personas MCP (HMAC-authed, ETag-cached)
  const personasRouteCode = substitutePlaceholders(readFileSync(join(ASSETS, "alaric-personas-route.ts"), "utf8"));
  console.log("    ℹ️   Requires secrets: ZO_ASK_TOKEN (HMAC verify) + ZO_API_KEY (list_personas upstream)");
  try {
    await deployRoute(`${assistSlug}-personas`, `/api/${assistSlug}-personas`, personasRouteCode);
  } catch (err) {
    console.error(`⚠️   /api/${assistSlug}-personas failed (non-fatal — persona dropdown empty):`, err);
  }

  // ── Fetch personas at deploy time (bake into page as static JSON) ──────────
  console.log("📋  Fetching personas list at deploy time…");
  let personasJson = "[]";
  try {
    const pRes = await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: { Authorization: IDENTITY_TOKEN!, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "List all personas. Return ONLY a JSON array of objects with id and name fields, no markdown, no explanation. Example: [{\"id\":\"uuid\",\"name\":\"Persona Name\"}]",
        model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
        output_format: {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, name: { type: "string" } },
                required: ["id", "name"],
              },
            },
          },
          required: ["personas"],
        },
      }),
    });
    if (pRes.ok) {
      const pData = await pRes.json() as { output: { personas: { id: string; name: string }[] } };
      const list = pData.output?.personas ?? [];
      if (list.length > 0) {
        personasJson = JSON.stringify(list);
        console.log(`✅  Fetched ${list.length} personas — baked into page`);
      } else {
        console.warn("⚠️   Personas list was empty — persona dropdown will have no options");
      }
    } else {
      console.warn(`⚠️   Could not fetch personas (${pRes.status}) — dropdown will be empty`);
    }
  } catch (err) {
    console.warn("⚠️   Personas fetch failed (non-fatal):", err);
  }

  // ── Portrait: upload as zo.space asset ───────────────────────────────────
  console.log("🖼️   Uploading portrait asset…");
  const PORTRAIT_GITHUB = "https://raw.githubusercontent.com/marlandoj/ai-assistant-voice/main/assets/ai-assistant-default.png";
  let PORTRAIT_URL = PORTRAIT_GITHUB;
  try {
    const imgRes = await fetch(PORTRAIT_GITHUB);
    if (imgRes.ok) {
      const imgBuf = Buffer.from(await imgRes.arrayBuffer());
      const tmpPath = join(tmpdir(), "ai-assistant-portrait.png");
      writeFileSync(tmpPath, imgBuf);

      // Upload via Zo API
      const uploadInstruction = `Upload the file at path "${tmpPath}" as a zo.space asset at asset_path "/images/ai-assistant-portrait.png" using the update_space_asset tool. Reply: OK or ERROR:<reason>`;
      const uRes = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: { Authorization: IDENTITY_TOKEN!, "Content-Type": "application/json" },
        body: JSON.stringify({ input: uploadInstruction, model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a" }),
      });
      if (uRes.ok) {
        const uData = await uRes.json() as { output: string };
        if (!(uData.output ?? "").startsWith("ERROR")) {
          PORTRAIT_URL = "/images/ai-assistant-portrait.png";
          console.log("✅  Portrait uploaded as zo.space asset");
        } else {
          console.warn("⚠️   Asset upload returned error — falling back to GitHub URL");
        }
      }
    }
  } catch (err) {
    console.warn("⚠️   Portrait upload failed (non-fatal — using GitHub URL):", err);
  }

  // /page route — substitute placeholders (personas baked in, portrait resolved)
  let pwaCode = substitutePlaceholders(readFileSync(join(ASSETS, "pwa-page.tsx"), "utf8"));
  pwaCode = pwaCode
    .replace(/\{\{PORTRAIT_PATH\}\}/g, PORTRAIT_URL)
    .replace(/\{\{PERSONAS_JSON\}\}/g, personasJson);

  try {
    await deployRoute("pwa-page", pagePath, pwaCode, "page");
  } catch (err) {
    console.error("❌ ", err);
    process.exit(1);
  }

  // ── PWA shell: manifest + service worker ──
  const manifestCode = substitutePlaceholders(readFileSync(join(ASSETS, "manifest-route.ts"), "utf8"))
    .replace(/\{\{PORTRAIT_PATH\}\}/g, PORTRAIT_URL);
  try {
    await deployRoute("manifest", `${pagePath}/manifest`, manifestCode);
  } catch (err) {
    console.error("⚠️   manifest route failed (non-fatal — PWA install prompt won't work):", err);
  }

  const swCode = substitutePlaceholders(readFileSync(join(ASSETS, "sw-route.ts"), "utf8"))
    .replace(/\{\{PORTRAIT_PATH\}\}/g, PORTRAIT_URL);
  try {
    await deployRoute("sw", `${pagePath}/sw`, swCode);
  } catch (err) {
    console.error("⚠️   service worker route failed (non-fatal — offline mode won't work):", err);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log("✅  AI Assistant Voice installation complete!\n");
console.log(`Zo Space Host : ${ZO_SPACE_HOST}`);
if (deployAll) {
  console.log(`Assistant     : ${assistName}  (slug: ${assistSlug})`);
  console.log(`PWA Page      : ${ZO_SPACE_HOST}${pagePath}  (private — sign in to view)`);
  console.log(`AI Proxy      : ${ZO_SPACE_HOST}/api/${assistSlug}-ask`);
  console.log(`TTS Proxy     : ${ZO_SPACE_HOST}/api/tts`);
  console.log(`RT Sessions   : ${ZO_SPACE_HOST}/api/realtime-session`);
  console.log(`MCP Server    : ${ZO_SPACE_HOST}/api/${assistSlug}-mcp`);
  console.log(`Personas      : ${ZO_SPACE_HOST}/api/${assistSlug}-personas  (dynamic — list_personas)`);
}
console.log("\nRequired secrets (Settings > Advanced):");
if (cfg.secret) console.log(`  ${cfg.secret.padEnd(25)} — TTS API key`);
if (deployAll)  console.log(`  ZO_ASK_TOKEN              — Zo access token for the AI proxy + HMAC session-token issuer`);
if (deployAll)  console.log(`  ZO_API_KEY                — Used by /api/${assistSlug}-mcp + /api/${assistSlug}-personas to call api.zo.computer`);
if (deployAll)  console.log(`  ${mcpTokenEnv.padEnd(25)} — Shared secret authenticating OpenAI Realtime → MCP server. Generate via 'openssl rand -hex 32'. (override env-var name with --mcp-token-secret)`);
if (deployAll)  console.log(`  MEMORY_DB_PATH            — Optional. Absolute path to a SQLite memory backend (default: /home/workspace/.zo/memory/shared-facts.db). When unset/missing, memory_search degrades gracefully.`);
if (deployAll)  console.log(`  OPENAI_API_KEY            — Only needed for Realtime mode`);
if (!cfg.secret) console.log("  (none for edge-tts — run setup-edge-tts.sh once)");
console.log("────────────────────────────────────────────────────────────\n");
