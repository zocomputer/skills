// /api/<slug>-mcp — JSON-RPC 2.0 MCP server exposing Zo tools to OpenAI Realtime.
//
// Required Zo Secrets:
//   {{MCP_TOKEN_ENV}} — shared secret (32-byte hex). OpenAI Realtime sends this
//                      in the server_url query (?t=...) since the zo.space
//                      Cloudflare proxy strips Authorization: Bearer. The env-var
//                      name is configurable via the deploy script's
//                      --mcp-token-secret flag (default: MCP_SHARED_TOKEN).
//   ZO_API_KEY        — used to call api.zo.computer/mcp upstream.
//
// Optional Zo Secrets:
//   MEMORY_DB_PATH    — absolute path to a SQLite memory backend exposing
//                       `open_loops` and `facts_fts` tables. If unset or the
//                       file is missing, the memory_search and list_open_loops
//                       tools are advertised but degrade gracefully with a
//                       "memory not configured" response. Default:
//                       /home/workspace/.zo/memory/shared-facts.db
//
// JSON-RPC methods implemented:
//   initialize, notifications/initialized, tools/list, tools/call, ping
//
// Auth precedence (first match wins):
//   1. X-Mcp-Token header
//   2. Authorization: Bearer ...
//   3. ?t= query param (Realtime path)

import type { Context } from "hono";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";

const ZO_MCP_ENDPOINT = "https://api.zo.computer/mcp";
const DEFAULT_MEMORY_DB = "/home/workspace/.zo/memory/shared-facts.db";
const MEMORY_DB_PATH = process.env.MEMORY_DB_PATH || DEFAULT_MEMORY_DB;
function memoryBackendAvailable(): boolean {
  try { return existsSync(MEMORY_DB_PATH); } catch { return false; }
}

const rlBuckets = new Map<string, number[]>();
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 240;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (rlBuckets.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_LIMIT) {
    rlBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  rlBuckets.set(ip, arr);
  if (rlBuckets.size > 5000) {
    for (const [k, v] of rlBuckets) {
      const fresh = v.filter((t) => now - t < RL_WINDOW_MS);
      if (fresh.length === 0) rlBuckets.delete(k);
      else rlBuckets.set(k, fresh);
    }
  }
  return true;
}

function getClientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

type JsonRpcId = string | number | null;

function jsonRpcOk(id: JsonRpcId, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function jsonRpcError(id: JsonRpcId, code: number, message: string, data?: unknown): Response {
  const error: Record<string, unknown> = { code, message };
  if (data !== undefined) error.data = data;
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function toolResult(text: string, isError = false) {
  return {
    content: [{ type: "text", text: text.slice(0, 8000) }],
    isError,
  };
}

async function callZoMcp(
  name: string,
  args: Record<string, unknown>,
  apiKey: string,
  timeoutMs = 15_000,
): Promise<{ ok: true; text: string } | { ok: false; error: string; isTimeout?: boolean }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const resp = await fetch(ZO_MCP_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        id: Date.now(),
        params: { name, arguments: args },
      }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    const raw = await resp.text();
    if (!resp.ok) return { ok: false, error: `Zo MCP HTTP ${resp.status}: ${raw.slice(0, 300)}` };
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, error: `Zo MCP non-JSON: ${raw.slice(0, 300)}` };
    }
    if (parsed?.error) return { ok: false, error: `Zo MCP error: ${JSON.stringify(parsed.error).slice(0, 300)}` };
    const content = parsed?.result?.content;
    const text =
      Array.isArray(content) && content[0]?.text
        ? String(content[0].text)
        : JSON.stringify(parsed?.result ?? parsed);
    if (parsed?.result?.isError) return { ok: false, error: text.slice(0, 600) };
    return { ok: true, text };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err?.name === "AbortError" ? `Timed out after ${timeoutMs}ms` : err?.message || "Unknown error",
      isTimeout: err?.name === "AbortError",
    };
  }
}

// =========================================================================
// TOOL DEFINITIONS — ordered by pack
// =========================================================================
const TOOL_DEFINITIONS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> = [
  // -------- ESSENTIALS --------
  {
    name: "list_open_loops",
    description: "List the user's currently open work items (loops/tasks-in-progress) from his workspace memory. Use when they ask about open loops, current work, what's in progress, what's pending, or backlog.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max items (1-50). Default 10." },
        status: { type: "string", enum: ["open", "resolved", "stale", "all"], description: "Filter by status. Default 'open'." },
      },
    },
  },
  {
    name: "memory_search",
    description: "Search the user's persistent memory (facts, decisions, preferences, conventions, project state) via FTS over a pluggable SQLite backend (default: shared-facts.db; override with MEMORY_DB_PATH). Use when they ask 'what do you remember about X', 'recall Z', or any question about prior decisions, project history, or stored facts. Degrades gracefully when no memory backend is configured.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms (sanitized to alnum + space + dash + underscore)." },
        limit: { type: "integer", description: "Max hits (1-20). Default 5." },
        scope: { type: "string", description: "Persona scope filter (e.g. 'shared', '<persona-slug>'). Default 'any' returns all scopes." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_agents",
    description: "List the user's persistent Zo agents (long-running named assistants).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_automations",
    description: "List the user's scheduled automations (cron-style scheduled tasks).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_calendar_events",
    description: "List upcoming events on the user's primary Google Calendar.",
    inputSchema: {
      type: "object",
      properties: {
        max_results: { type: "integer", description: "Max events (1-20). Default 5." },
      },
    },
  },
  {
    name: "send_email",
    description: "Send the user a markdown email. Use when they say 'email me', 'send me an email', 'follow up by email'.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Email subject line." },
        body: { type: "string", description: "Markdown email body." },
      },
      required: ["subject", "body"],
    },
  },
  {
    name: "send_sms",
    description: "Send the user an SMS text message. Use when they say 'text me', 'send me a text', 'sms me'.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Text message body (keep short)." },
        contact_name: { type: "string", description: "Optional named contact." },
      },
      required: ["message"],
    },
  },
  {
    name: "read_file",
    description: "Read the first 200 lines of a workspace file. Path must start with /home/workspace/.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path under /home/workspace/." },
      },
      required: ["path"],
    },
  },
  {
    name: "workspace_search",
    description: "Grep the user's workspace for content or filenames.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term." },
        kind: { type: "string", enum: ["content", "filename"], description: "Default 'content'." },
      },
      required: ["query"],
    },
  },
  {
    name: "web_search",
    description: "Search the live web for current information (news, weather, prices, recent events).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Web search query." },
        time_range: { type: "string", enum: ["anytime", "day", "week", "month", "year"], description: "Default 'week'." },
      },
      required: ["query"],
    },
  },
  {
    name: "list_files",
    description: "List files and folders in a workspace directory.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path under /home/workspace/." },
      },
      required: ["path"],
    },
  },
  {
    name: "list_personas",
    description: "List the user's available Zo personas.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_user_services",
    description: "List the user's hosted user services (HTTP/TCP/process services).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_space_errors",
    description: "Check for runtime errors in the user's zo.space routes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "web_research",
    description: "Deeper web research with category filters (better quality than web_search). Use for in-depth queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Research query." },
        category: { type: "string", description: "Optional: company, research_paper, pdf, github, tweet, personal_site, linkedin_profile, financial_report, people." },
      },
      required: ["query"],
    },
  },
  {
    name: "find_similar_links",
    description: "Find webpages similar to a given URL (semantic similarity).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Source URL." },
      },
      required: ["url"],
    },
  },
  {
    name: "maps_search",
    description: "Search Google Maps for places (restaurants, stores, services).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Place query, e.g. 'coffee near Phoenix'." },
        open_now: { type: "boolean", description: "Filter to currently open." },
      },
      required: ["query"],
    },
  },
  {
    name: "read_webpage",
    description: "Fetch and read a webpage's text content (or YouTube transcript).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Webpage URL." },
      },
      required: ["url"],
    },
  },
  // -------- POWER --------
  {
    name: "image_search",
    description: "Search the web for images of real-world objects, places, or concepts.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Image query." },
      },
      required: ["query"],
    },
  },
  {
    name: "generate_image",
    description: "Generate an illustration or image from a natural language prompt. Saves to workspace.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Image description prompt." },
      },
      required: ["prompt"],
    },
  },
  {
    name: "save_webpage",
    description: "Save a webpage to the user's Articles folder for later reference.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "Webpage URL." },
      },
      required: ["url"],
    },
  },
  {
    name: "transcribe_audio",
    description: "Transcribe an audio file in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to audio file under /home/workspace/." },
      },
      required: ["path"],
    },
  },
  {
    name: "transcribe_video",
    description: "Transcribe a video file in the workspace.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Absolute path to video file under /home/workspace/." },
      },
      required: ["path"],
    },
  },
  {
    name: "service_doctor",
    description: "Diagnose health of a hosted user service.",
    inputSchema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "User service ID." },
      },
      required: ["service_id"],
    },
  },
  {
    name: "gmail_search",
    description: "Search the user's Gmail with a query (e.g. 'from:boss subject:invoice newer_than:7d').",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query." },
        max_results: { type: "integer", description: "Max results (1-20). Default 10." },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_read",
    description: "Read a specific Gmail message by ID.",
    inputSchema: {
      type: "object",
      properties: {
        message_id: { type: "string", description: "Gmail message ID." },
      },
      required: ["message_id"],
    },
  },
  {
    name: "calendar_create_event",
    description: "Create a calendar event via Google Calendar quick-add (natural language, e.g. 'lunch with Kevin tomorrow at noon').",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Quick-add natural language event description." },
      },
      required: ["text"],
    },
  },
  // -------- POWER_WITH_WRITES --------
  {
    name: "set_active_persona",
    description: "Switch the user's active Zo persona by ID. Affects subsequent chat sessions.",
    inputSchema: {
      type: "object",
      properties: {
        persona_id: { type: "string", description: "Persona UUID." },
      },
      required: ["persona_id"],
    },
  },
  {
    name: "create_agent",
    description: "Create a new scheduled Zo agent.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        instructions: { type: "string" },
        rrule: { type: "string", description: "RFC5545 rrule for schedule." },
      },
      required: ["name", "instructions", "rrule"],
    },
  },
  {
    name: "edit_agent",
    description: "Edit an existing Zo agent.",
    inputSchema: {
      type: "object",
      properties: {
        agent_id: { type: "string" },
        instructions: { type: "string" },
      },
      required: ["agent_id"],
    },
  },
  {
    name: "create_automation",
    description: "Create a new scheduled automation.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        prompt: { type: "string" },
        rrule: { type: "string" },
      },
      required: ["name", "prompt", "rrule"],
    },
  },
  {
    name: "edit_automation",
    description: "Edit an existing scheduled automation.",
    inputSchema: {
      type: "object",
      properties: {
        automation_id: { type: "string" },
        prompt: { type: "string" },
      },
      required: ["automation_id"],
    },
  },
  {
    name: "write_space_route",
    description: "Create or fully replace a zo.space route.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        route_type: { type: "string", enum: ["api", "page"] },
        code: { type: "string" },
      },
      required: ["path", "route_type", "code"],
    },
  },
  {
    name: "edit_space_route",
    description: "Edit an existing zo.space route by sending only changed sections.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        code_edit: { type: "string" },
      },
      required: ["path", "code_edit"],
    },
  },
  {
    name: "publish_site",
    description: "Publish a Zo Site by site directory.",
    inputSchema: {
      type: "object",
      properties: {
        site_path: { type: "string", description: "Absolute path to site directory under /home/workspace/." },
      },
      required: ["site_path"],
    },
  },
];

// =========================================================================
// CUSTOM TOOL HANDLERS
// =========================================================================

async function handleListOpenLoops(args: any, apiKey: string) {
  if (!memoryBackendAvailable()) {
    return toolResult(`Memory backend not configured (no file at ${MEMORY_DB_PATH}). Set MEMORY_DB_PATH in Zo Secrets to point at a SQLite DB exposing an 'open_loops' table.`, true);
  }
  const limit = Math.min(Math.max(parseInt(args?.limit ?? "10", 10) || 10, 1), 50);
  const ALLOWED = new Set(["open", "resolved", "stale", "superseded", "all"]);
  const requested = String(args?.status ?? "open");
  if (!ALLOWED.has(requested)) return toolResult("invalid status; allowed: open|resolved|stale|superseded|all", true);
  const where = requested === "all" ? "" : `WHERE status='${requested}'`;
  const sql = `SELECT id || '|' || title || '|' || kind || '|' || priority FROM open_loops ${where} ORDER BY priority DESC, updated_at DESC LIMIT ${limit};`;
  const cmd = `sqlite3 ${MEMORY_DB_PATH} "${sql.replace(/"/g, '\\"')}"`;
  const r = await callZoMcp("run_bash_command", { cmd }, apiKey, 10_000);
  if (!r.ok) return toolResult(r.error, true);
  const m = r.text.match(/stdout='([\s\S]*?)', stderr=/);
  const stdout = m ? m[1].replace(/\\n/g, "\n") : r.text;
  const lines = stdout.split("\n").filter(Boolean);
  if (!lines.length) return toolResult(`No ${requested} loops.`);
  const summary = lines
    .slice(0, limit)
    .map((line) => {
      const [, title, kind, priority] = line.split("|");
      return `• [${kind}] ${title?.slice(0, 120)} (p=${priority})`;
    })
    .join("\n");
  return toolResult(`Open loops (${lines.length} ${requested}):\n${summary}`);
}

async function handleMemorySearch(args: any, apiKey: string) {
  if (!memoryBackendAvailable()) {
    return toolResult(`Memory backend not configured (no file at ${MEMORY_DB_PATH}). Set MEMORY_DB_PATH in Zo Secrets to point at a SQLite DB exposing 'facts' + 'facts_fts' tables.`, true);
  }
  const rawQuery = String(args?.query || "").trim();
  if (!rawQuery) return toolResult("missing query", true);
  const query = rawQuery.replace(/[^a-zA-Z0-9 _\-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!query) return toolResult("query empty after sanitization", true);
  const limit = Math.min(Math.max(parseInt(args?.limit ?? "5", 10) || 5, 1), 20);
  const requestedScope = String(args?.scope ?? "any").trim();
  const safeScope = /^[a-zA-Z0-9_\-]{1,40}$/.test(requestedScope) ? requestedScope : "any";
  const personaFilter = safeScope === "any" ? "" : `AND f.persona = '${safeScope}'`;
  const sql = `SELECT f.entity || '.' || COALESCE(f.key,'') || '|' || substr(f.value,1,200) || '|' || f.decay_class || '|' || COALESCE(f.persona,'shared') FROM facts_fts ft JOIN facts f ON f.rowid=ft.rowid WHERE facts_fts MATCH '${query}' ${personaFilter} ORDER BY rank LIMIT ${limit};`;
  const cmd = `sqlite3 ${MEMORY_DB_PATH} "${sql.replace(/"/g, '\\"')}"`;
  const r = await callZoMcp("run_bash_command", { cmd }, apiKey, 10_000);
  if (!r.ok) return toolResult(r.error, true);
  const m = r.text.match(/stdout='([\s\S]*?)', stderr=/);
  const stdout = m ? m[1].replace(/\\n/g, "\n") : r.text;
  const lines = stdout.split("\n").filter(Boolean);
  if (!lines.length) return toolResult(`No memory hits for "${query}".`);
  const summary = lines
    .slice(0, limit)
    .map((line) => {
      const [path, value, decay, persona] = line.split("|");
      return `• [${decay}/${persona}] ${path}: ${value?.slice(0, 180)}`;
    })
    .join("\n");
  return toolResult(`Memory hits for "${query}" (${lines.length}):\n${summary}`);
}

// =========================================================================
// PASS-THROUGH HANDLERS (sanitized wrappers around Zo MCP tools)
// =========================================================================

async function handleReadFile(args: any, apiKey: string) {
  const target = String(args?.path || "").trim();
  if (!target.startsWith("/home/workspace/") || target.includes("..") || target.includes("\0")) {
    return toolResult("Only /home/workspace/ files allowed (no traversal).", true);
  }
  const r = await callZoMcp(
    "read_file",
    { target_file: target, text_start_line_1_indexed: 1, text_end_line_1_indexed_inclusive: 200 },
    apiKey,
    15_000,
  );
  return r.ok ? toolResult(r.text) : toolResult(r.error, true);
}

async function handleWorkspaceSearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  const searchKind = args?.kind === "filename" ? "filename" : "content";
  const r = await callZoMcp("grep_search", { query, search_kind: searchKind, location: "USER" }, apiKey, 15_000);
  return r.ok ? toolResult(r.text) : toolResult(r.error, true);
}

async function handleListFiles(args: any, apiKey: string) {
  const target = String(args?.path || "").trim();
  if (!target.startsWith("/home/workspace/") || target.includes("..") || target.includes("\0")) {
    return toolResult("Only /home/workspace/ paths allowed.", true);
  }
  const r = await callZoMcp("list_files", { path: target }, apiKey, 10_000);
  return r.ok ? toolResult(r.text) : toolResult(r.error, true);
}

async function passthrough(name: string, args: Record<string, unknown>, apiKey: string, timeoutMs = 15_000) {
  const r = await callZoMcp(name, args, apiKey, timeoutMs);
  return r.ok ? toolResult(r.text) : toolResult(r.error, true);
}

async function handleListAgents(_a: any, k: string) { return passthrough("list_agents", {}, k); }
async function handleListAutomations(_a: any, k: string) { return passthrough("list_automations", {}, k); }
async function handleListPersonas(_a: any, k: string) { return passthrough("list_personas", {}, k); }
async function handleListUserServices(_a: any, k: string) { return passthrough("list_user_services", {}, k); }
async function handleGetSpaceErrors(_a: any, k: string) { return passthrough("get_space_errors", {}, k); }
async function handleServiceDoctor(a: any, k: string) {
  const id = String(a?.service_id || "").trim();
  if (!id) return toolResult("missing service_id", true);
  return passthrough("service_doctor", { service_id: id }, k, 30_000);
}
async function handleSetActivePersona(a: any, k: string) {
  const id = String(a?.persona_id || "").trim();
  if (id.length !== 36) return toolResult("invalid persona_id", true);
  return passthrough("set_active_persona", { persona_id: id }, k);
}

async function handleListCalendarEvents(args: any, apiKey: string) {
  const maxResults = Math.min(parseInt(args?.max_results ?? "5", 10) || 5, 20);
  return passthrough(
    "use_app_google_calendar",
    { tool_name: "google_calendar-list-events", configured_props: { calendarId: "primary", maxResults } },
    apiKey,
    15_000,
  );
}

async function handleCalendarCreateEvent(args: any, apiKey: string) {
  const text = String(args?.text || "").trim();
  if (!text) return toolResult("missing event text", true);
  return passthrough(
    "use_app_google_calendar",
    { tool_name: "google_calendar-quick-add-event", configured_props: { calendarId: "primary", text } },
    apiKey,
    15_000,
  );
}

async function handleSendEmail(args: any, apiKey: string) {
  const subject = String(args?.subject || "").trim();
  const body = String(args?.body || "").trim();
  if (!subject) return toolResult("missing subject", true);
  if (!body) return toolResult("missing body", true);
  const r = await callZoMcp("send_email_to_user", { subject, markdown_body: body }, apiKey, 20_000);
  return r.ok ? toolResult("Email sent.") : toolResult(r.error, true);
}

async function handleSendSms(args: any, apiKey: string) {
  const message = String(args?.message || "").trim();
  if (!message) return toolResult("missing message", true);
  const r = await callZoMcp(
    "send_sms_to_user",
    { message, ...(args?.contact_name ? { contact_name: String(args.contact_name) } : {}) },
    apiKey,
    20_000,
  );
  return r.ok ? toolResult("SMS sent.") : toolResult(r.error, true);
}

async function handleWebSearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  const time_range = ["anytime", "day", "week", "month", "year"].includes(args?.time_range)
    ? args.time_range
    : "week";
  return passthrough("web_search", { query, time_range }, apiKey, 25_000);
}

async function handleWebResearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  const params: Record<string, unknown> = { query };
  if (args?.category) params.category = String(args.category);
  return passthrough("web_research", params, apiKey, 30_000);
}

async function handleFindSimilarLinks(args: any, apiKey: string) {
  const url = String(args?.url || "").trim();
  if (!url.startsWith("http")) return toolResult("invalid url", true);
  return passthrough("find_similar_links", { url }, apiKey, 20_000);
}

async function handleMapsSearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  const params: Record<string, unknown> = { query };
  if (typeof args?.open_now === "boolean") params.open_now = args.open_now;
  return passthrough("maps_search", params, apiKey, 20_000);
}

async function handleReadWebpage(args: any, apiKey: string) {
  const url = String(args?.url || "").trim();
  if (!url.startsWith("http")) return toolResult("invalid url", true);
  return passthrough("read_webpage", { url }, apiKey, 30_000);
}

async function handleSaveWebpage(args: any, apiKey: string) {
  const url = String(args?.url || "").trim();
  if (!url.startsWith("http")) return toolResult("invalid url", true);
  return passthrough("save_webpage", { url }, apiKey, 30_000);
}

async function handleImageSearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  return passthrough("image_search", { query }, apiKey, 20_000);
}

async function handleGenerateImage(args: any, apiKey: string) {
  const prompt = String(args?.prompt || "").trim();
  if (!prompt) return toolResult("missing prompt", true);
  return passthrough("generate_image", { prompt }, apiKey, 60_000);
}

async function handleTranscribeAudio(args: any, apiKey: string) {
  const target = String(args?.path || "").trim();
  if (!target.startsWith("/home/workspace/") || target.includes("..") || target.includes("\0")) {
    return toolResult("Only /home/workspace/ paths allowed.", true);
  }
  return passthrough("transcribe_audio", { path: target }, apiKey, 120_000);
}

async function handleTranscribeVideo(args: any, apiKey: string) {
  const target = String(args?.path || "").trim();
  if (!target.startsWith("/home/workspace/") || target.includes("..") || target.includes("\0")) {
    return toolResult("Only /home/workspace/ paths allowed.", true);
  }
  return passthrough("transcribe_video", { path: target }, apiKey, 180_000);
}

async function handleGmailSearch(args: any, apiKey: string) {
  const query = String(args?.query || "").trim();
  if (!query) return toolResult("missing query", true);
  const max_results = Math.min(parseInt(args?.max_results ?? "10", 10) || 10, 20);
  return passthrough(
    "use_app_gmail",
    { tool_name: "gmail-search-email", configured_props: { q: query, maxResults: max_results } },
    apiKey,
    20_000,
  );
}

async function handleGmailRead(args: any, apiKey: string) {
  const id = String(args?.message_id || "").trim();
  if (!id) return toolResult("missing message_id", true);
  return passthrough(
    "use_app_gmail",
    { tool_name: "gmail-read-email", configured_props: { messageId: id } },
    apiKey,
    20_000,
  );
}

async function handleCreateAgent(args: any, apiKey: string) {
  const name = String(args?.name || "").trim();
  const instructions = String(args?.instructions || "").trim();
  const rrule = String(args?.rrule || "").trim();
  if (!name || !instructions || !rrule) return toolResult("name, instructions, rrule all required", true);
  return passthrough("create_agent", { name, instructions, rrule }, apiKey, 30_000);
}

async function handleEditAgent(args: any, apiKey: string) {
  const agent_id = String(args?.agent_id || "").trim();
  if (!agent_id) return toolResult("missing agent_id", true);
  const params: Record<string, unknown> = { agent_id };
  if (args?.instructions) params.instructions = String(args.instructions);
  return passthrough("edit_agent", params, apiKey, 30_000);
}

async function handleCreateAutomation(args: any, apiKey: string) {
  const name = String(args?.name || "").trim();
  const prompt = String(args?.prompt || "").trim();
  const rrule = String(args?.rrule || "").trim();
  if (!name || !prompt || !rrule) return toolResult("name, prompt, rrule all required", true);
  return passthrough("create_automation", { name, prompt, rrule }, apiKey, 30_000);
}

async function handleEditAutomation(args: any, apiKey: string) {
  const automation_id = String(args?.automation_id || "").trim();
  if (!automation_id) return toolResult("missing automation_id", true);
  const params: Record<string, unknown> = { automation_id };
  if (args?.prompt) params.prompt = String(args.prompt);
  return passthrough("edit_automation", params, apiKey, 30_000);
}

async function handleWriteSpaceRoute(args: any, apiKey: string) {
  const path = String(args?.path || "").trim();
  const route_type = String(args?.route_type || "").trim();
  const code = String(args?.code || "");
  if (!path.startsWith("/")) return toolResult("path must start with /", true);
  if (!["api", "page"].includes(route_type)) return toolResult("route_type must be 'api' or 'page'", true);
  if (!code) return toolResult("missing code", true);
  return passthrough("write_space_route", { path, route_type, code }, apiKey, 30_000);
}

async function handleEditSpaceRoute(args: any, apiKey: string) {
  const path = String(args?.path || "").trim();
  const code_edit = String(args?.code_edit || "");
  if (!path.startsWith("/")) return toolResult("path must start with /", true);
  if (!code_edit) return toolResult("missing code_edit", true);
  return passthrough("edit_space_route", { path, code_edit }, apiKey, 30_000);
}

async function handlePublishSite(args: any, apiKey: string) {
  const site_path = String(args?.site_path || "").trim();
  if (!site_path.startsWith("/home/workspace/")) return toolResult("site_path must start with /home/workspace/", true);
  return passthrough("publish_site", { site_path }, apiKey, 60_000);
}

// =========================================================================
// DISPATCHER
// =========================================================================

async function dispatchTool(name: string, args: any, apiKey: string) {
  switch (name) {
    case "list_open_loops": return await handleListOpenLoops(args, apiKey);
    case "memory_search": return await handleMemorySearch(args, apiKey);
    case "list_agents": return await handleListAgents(args, apiKey);
    case "list_automations": return await handleListAutomations(args, apiKey);
    case "list_calendar_events": return await handleListCalendarEvents(args, apiKey);
    case "send_email": return await handleSendEmail(args, apiKey);
    case "send_sms": return await handleSendSms(args, apiKey);
    case "read_file": return await handleReadFile(args, apiKey);
    case "workspace_search": return await handleWorkspaceSearch(args, apiKey);
    case "web_search": return await handleWebSearch(args, apiKey);
    case "list_files": return await handleListFiles(args, apiKey);
    case "list_personas": return await handleListPersonas(args, apiKey);
    case "list_user_services": return await handleListUserServices(args, apiKey);
    case "get_space_errors": return await handleGetSpaceErrors(args, apiKey);
    case "web_research": return await handleWebResearch(args, apiKey);
    case "find_similar_links": return await handleFindSimilarLinks(args, apiKey);
    case "maps_search": return await handleMapsSearch(args, apiKey);
    case "read_webpage": return await handleReadWebpage(args, apiKey);
    case "image_search": return await handleImageSearch(args, apiKey);
    case "generate_image": return await handleGenerateImage(args, apiKey);
    case "save_webpage": return await handleSaveWebpage(args, apiKey);
    case "transcribe_audio": return await handleTranscribeAudio(args, apiKey);
    case "transcribe_video": return await handleTranscribeVideo(args, apiKey);
    case "service_doctor": return await handleServiceDoctor(args, apiKey);
    case "gmail_search": return await handleGmailSearch(args, apiKey);
    case "gmail_read": return await handleGmailRead(args, apiKey);
    case "calendar_create_event": return await handleCalendarCreateEvent(args, apiKey);
    case "set_active_persona": return await handleSetActivePersona(args, apiKey);
    case "create_agent": return await handleCreateAgent(args, apiKey);
    case "edit_agent": return await handleEditAgent(args, apiKey);
    case "create_automation": return await handleCreateAutomation(args, apiKey);
    case "edit_automation": return await handleEditAutomation(args, apiKey);
    case "write_space_route": return await handleWriteSpaceRoute(args, apiKey);
    case "edit_space_route": return await handleEditSpaceRoute(args, apiKey);
    case "publish_site": return await handlePublishSite(args, apiKey);
    default:
      return toolResult(`Unknown tool: ${name}`, true);
  }
}

// =========================================================================
// MAIN HANDLER (JSON-RPC 2.0 over HTTP)
// =========================================================================

export default async (c: Context): Promise<Response> => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  if (c.req.method !== "POST") {
    return jsonRpcError(null, -32600, "Method not allowed (HTTP)");
  }

  const ip = getClientIp(c);
  if (!rateLimit(ip)) {
    return jsonRpcError(null, -32000, "Rate limited");
  }

  const MCP_TOKEN_ENV = "{{MCP_TOKEN_ENV}}";
  const expected = process.env[MCP_TOKEN_ENV];
  if (!expected) {
    return jsonRpcError(null, -32002, `${MCP_TOKEN_ENV} not configured in Zo Secrets`);
  }
  const customAuth = c.req.header("x-mcp-token") || "";
  const bearerAuth = c.req.header("authorization") || "";
  const queryToken = c.req.query("t") || "";
  let token = "";
  if (customAuth) {
    token = customAuth;
  } else if (bearerAuth.startsWith("Bearer ")) {
    token = bearerAuth.slice(7);
  } else if (queryToken) {
    token = queryToken;
  } else {
    return jsonRpcError(null, -32001, "Unauthorized (send X-Mcp-Token, Authorization: Bearer, or ?t= query)");
  }
  if (!constantTimeEqual(token, expected)) {
    return jsonRpcError(null, -32001, "Invalid token");
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return jsonRpcError(null, -32700, "Parse error");
  }

  const id = (body?.id ?? null) as JsonRpcId;
  const method = String(body?.method || "");
  const params = body?.params || {};

  if (method === "initialize") {
    return jsonRpcOk(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "alaric-mcp", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (method === "tools/list") {
    return jsonRpcOk(id, { tools: TOOL_DEFINITIONS });
  }

  if (method === "tools/call") {
    const toolName = String(params?.name || "");
    const toolArgs = params?.arguments || {};
    const apiKey = process.env.ZO_API_KEY;
    if (!apiKey) return jsonRpcOk(id, toolResult("ZO_API_KEY not configured", true));
    try {
      const REALTIME_HARD_CAP_MS = 10_000;
      const result = await Promise.race([
        dispatchTool(toolName, toolArgs, apiKey),
        new Promise<ReturnType<typeof toolResult>>((resolve) =>
          setTimeout(
            () => resolve(toolResult("That's taking longer than real-time allows. I'll send the result via SMS once it completes — ask me to follow up.", false)),
            REALTIME_HARD_CAP_MS,
          )
        ),
      ]);
      return jsonRpcOk(id, result);
    } catch (err: any) {
      console.error(`[alaric-mcp] tool error ${toolName}:`, err);
      return jsonRpcOk(id, toolResult(`Tool error: ${err?.message || "unknown"}`, true));
    }
  }

  if (method === "ping") {
    return jsonRpcOk(id, {});
  }

  return jsonRpcError(id, -32601, `Method not found: ${method}`);
};
