#!/usr/bin/env node
/**
 * AstraDB Memory Sync & Query
 *
 * Mirrors zobodhi-memory (JSON) and Clarion (markdown tree) into the
 * AstraDB `memories` collection. Idempotent upserts.
 *
 * Usage:
 *   bun run sync.ts sync [--source=zobodhi|clarion]
 *   bun run sync.ts status
 *   bun run sync.ts query <text> [--source=...]
 *   bun run sync.ts add <fact>
 *   bun run sync.ts tail [n]
 */

import { promises as fs } from "fs";
import path from "path";

const ASTRA_ENDPOINT = process.env.ASTRA_DB_ENDPOINT?.replace(/\/$/, "");
const ASTRA_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;
const ASTRA_KEYSPACE = process.env.ASTRA_DB_KEYSPACE || "default_keyspace";
const COLLECTION = "memories";

const ZOBODHI_JSON = "/home/workspace/Skills/zobodhi-memory/memory.json";
const CLARION_ROOT = "/home/workspace/memory";

// ---------- Astra client ----------

interface AstraResponse {
  data?: { documents?: any[]; nextPageState?: string | null };
  status?: { count?: number; ok?: number };
  errors?: { title: string; message: string }[];
}

async function astra(
  method: "POST" | "GET" | "DELETE",
  body?: any
): Promise<any> {
  if (!ASTRA_ENDPOINT || !ASTRA_TOKEN) {
    throw new Error(
      "Missing ASTRA_DB_ENDPOINT or ASTRA_DB_APPLICATION_TOKEN env vars. Set them in Settings > Advanced."
    );
  }
  const url = `${ASTRA_ENDPOINT}/api/json/v1/${ASTRA_KEYSPACE}/${COLLECTION}`;
  const res = await fetch(url, {
    method,
    headers: {
      Token: ASTRA_TOKEN,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as AstraResponse;
  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e) => `${e.title}: ${e.message}`).join("; ");
    throw new Error(`Astra error — ${msg}`);
  }
  return json;
}

async function findAll(filter: Record<string, any> = {}): Promise<any[]> {
  const all: any[] = [];
  let pageState: string | null = null;
  for (let i = 0; i < 200; i++) {
    const body: any = {
      find: { filter, options: { limit: 100, pageState: pageState ?? undefined } },
    };
    const r = await astra("POST", body);
    const docs = r.data?.documents ?? [];
    all.push(...docs);
    pageState = r.data?.nextPageState ?? null;
    if (!pageState || docs.length === 0) break;
  }
  return all;
}

// ---------- Source readers ----------

interface ZobodhiFact {
  id: number;
  text: string;
  addedAt: string;
  tags: string[];
}

async function readZobodhi(): Promise<ZobodhiFact[]> {
  try {
    const raw = await fs.readFile(ZOBODHI_JSON, "utf8");
    const db = JSON.parse(raw);
    return Array.isArray(db.memories) ? db.memories : [];
  } catch (e) {
    console.warn(`⚠️  Could not read zobodhi memory.json: ${e}`);
    return [];
  }
}

function frontmatter(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]+?)\n---\n/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w[\w_-]*):\s*(.+?)\s*$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^['"]|['"]$/g, "");
  }
  return fm;
}

function firstHeading(text: string): string {
  const m = text.match(/^#\s+(.+)$/m);
  if (m) return m[1].trim();
  return text.replace(/\s+/g, " ").slice(0, 80).trim();
}

function inferProject(filePath: string, fm: Record<string, string>): string {
  if (fm.project) return fm.project.toLowerCase();
  if (filePath.includes("/projects/")) {
    const m = filePath.match(/\/projects\/([^/]+)\.md/);
    if (m) return m[1].toLowerCase();
  }
  if (filePath.includes("/daily/")) return "daily";
  if (filePath.includes("/feedback/")) return "feedback";
  return "system";
}

function inferLayer(filePath: string, fm: Record<string, string>): string {
  if (fm.type) {
    const t = fm.type.toLowerCase();
    if (t.includes("project")) return "semantic";
    if (t.includes("feedback")) return "fact";
    if (t.includes("reference")) return "semantic";
  }
  if (filePath.includes("/daily/")) return "session";
  if (filePath.includes("/projects/") || filePath.includes("/reference/"))
    return "semantic";
  if (filePath.includes("/feedback/")) return "fact";
  return "fact";
}

async function walkMarkdown(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries: any[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile() && e.name.endsWith(".md") && !e.name.startsWith("_"))
        out.push(p);
    }
  }
  await walk(root);
  return out;
}

interface ClarionDoc {
  source: string;
  layer: string;
  text: string;
  path: string;
  timestamp: string;
  tags: string[];
  project: string;
  title: string;
}

async function readClarion(): Promise<ClarionDoc[]> {
  const files = await walkMarkdown(CLARION_ROOT);
  const out: ClarionDoc[] = [];
  for (const f of files) {
    const rel = f.replace("/home/workspace/memory/", "");
    const source = rel.startsWith("daily/")
      ? "clarion_daily"
      : rel.startsWith("projects/")
        ? "clarion_project"
        : rel.startsWith("feedback/")
          ? "clarion_feedback"
          : rel.startsWith("reference/")
            ? "clarion_reference"
            : rel.startsWith("projects/") || rel.endsWith("-topics.md")
              ? "clarion_topics"
              : "clarion_bootstrap";
    try {
      const text = await fs.readFile(f, "utf8");
      const fm = frontmatter(text);
      const stat = await fs.stat(f);
      out.push({
        source,
        layer: inferLayer(f, fm),
        text: text.trim(),
        path: f,
        timestamp:
          fm.date || stat.mtime.toISOString().slice(0, 19) + "Z",
        tags: fm.tags
          ? fm.tags
              .replace(/^\[|\]$/g, "")
              .split(",")
              .map((t) => t.trim())
          : [],
        project: inferProject(f, fm),
        title: fm.name || firstHeading(text),
      });
    } catch (e) {
      console.warn(`⚠️  Could not read ${f}: ${e}`);
    }
  }
  return out;
}

// ---------- Sync logic ----------

function buildZobodhiDocs(facts: ZobodhiFact[]): ClarionDoc[] {
  return facts.map((f) => ({
    source: "zobodhi",
    layer: "fact",
    text: f.text,
    path: ZOBODHI_JSON,
    timestamp: f.addedAt,
    tags: f.tags || [],
    project: "general",
    title: f.text.replace(/\s+/g, " ").slice(0, 80),
  }));
}

async function upsertAll(docs: ClarionDoc[]): Promise<{ inserted: number; skipped: number }> {
  const existing = await findAll({});
  const existingKey = new Map<string, string>();
  for (const d of existing) {
    const key = `${d.source}::${(d.text || "").slice(0, 200)}`;
    existingKey.set(key, d._id);
  }
  let inserted = 0;
  let skipped = 0;
  for (const doc of docs) {
    const key = `${doc.source}::${(doc.text || "").slice(0, 200)}`;
    if (existingKey.has(key)) {
      skipped++;
      continue;
    }
    try {
      await astra("POST", { insertOne: { document: doc } });
      inserted++;
    } catch (e: any) {
      console.error(`  ✗ insert failed for ${doc.source} ${doc.title}: ${e.message}`);
    }
  }
  return { inserted, skipped };
}

async function cmdSync(args: string[]) {
  const sourceArg = args
    .find((a) => a.startsWith("--source="))
    ?.split("=")[1];

  console.log("📥 Reading sources...");
  const docs: ClarionDoc[] = [];
  if (!sourceArg || sourceArg === "zobodhi") {
    const facts = await readZobodhi();
    console.log(`  zobodhi:  ${facts.length} facts`);
    docs.push(...buildZobodhiDocs(facts));
  }
  if (!sourceArg || sourceArg === "clarion") {
    const clarion = await readClarion();
    console.log(`  clarion:  ${clarion.length} markdown docs`);
    docs.push(...clarion);
  }

  console.log(`☁️  Upserting ${docs.length} docs into Astra...`);
  const { inserted, skipped } = await upsertAll(docs);
  console.log(`✅ Done. inserted=${inserted}, skipped(existing)=${skipped}`);
  // write timestamp
  const tsFile = path.join(path.dirname(new URL(import.meta.url).pathname), "last-sync.json");
  await fs.writeFile(
    tsFile,
    JSON.stringify({ lastSync: new Date().toISOString(), inserted, skipped })
  );
}

async function cmdStatus() {
  const all = await findAll({});
  const bySource: Record<string, number> = {};
  const byLayer: Record<string, number> = {};
  for (const d of all) {
    bySource[d.source] = (bySource[d.source] || 0) + 1;
    byLayer[d.layer] = (byLayer[d.layer] || 0) + 1;
  }
  console.log(`📊 Total memories in Astra: ${all.length}`);
  console.log("\nBy source:");
  for (const [k, v] of Object.entries(bySource).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(25)} ${v}`);
  console.log("\nBy layer:");
  for (const [k, v] of Object.entries(byLayer).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(25)} ${v}`);
  try {
    const tsFile = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "last-sync.json"
    );
    const ts = JSON.parse(await fs.readFile(tsFile, "utf8"));
    console.log(`\nLast sync: ${ts.lastSync}`);
    console.log(`  inserted=${ts.inserted}, skipped=${ts.skipped}`);
  } catch {}
}

async function cmdQuery(args: string[]) {
  const sourceArg = args
    .find((a) => a.startsWith("--source="))
    ?.split("=")[1];
  const text = args.filter((a) => !a.startsWith("--")).join(" ").trim();
  if (!text) {
    console.log('Usage: query <text> [--source=zobodhi|clarion]');
    return;
  }
  const filter: Record<string, any> = {};
  if (sourceArg) {
    const map: Record<string, string> = {
      zobodhi: "zobodhi",
      clarion: "clarion_daily",
      daily: "clarion_daily",
      project: "clarion_project",
      feedback: "clarion_feedback",
      reference: "clarion_reference",
      topics: "clarion_topics",
      bootstrap: "clarion_bootstrap",
    };
    filter.source = map[sourceArg] || sourceArg;
  }
  const docs = await findAll(filter);
  const q = text.toLowerCase();
  const scored = docs
    .map((d) => {
      const t = (d.text || "").toLowerCase();
      const title = (d.title || "").toLowerCase();
      let score = 0;
      if (title.includes(q)) score += 10;
      // count occurrences
      let idx = 0;
      while ((idx = t.indexOf(q, idx)) !== -1) {
        score += 1;
        idx += q.length;
      }
      return { d, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scored.length === 0) {
    console.log("🔎 No matching memories found.");
    return;
  }
  console.log(`🔍 Top ${scored.length} matches:\n`);
  for (const { d, score } of scored) {
    console.log(`  [${d.source} | ${d.layer} | score=${score}] ${d.title}`);
    console.log(`    ${d.path}`);
    console.log(`    ${d.timestamp}`);
    // show a snippet
    const idx = (d.text || "").toLowerCase().indexOf(q);
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      const end = Math.min(d.text.length, idx + 160);
      console.log(`    …${d.text.slice(start, end).replace(/\n+/g, " ")}…`);
    }
    console.log();
  }
}

async function cmdAdd(args: string[]) {
  const text = args.join(" ").trim();
  if (!text) {
    console.log("Usage: add <fact text>");
    return;
  }
  const fact: ZobodhiFact = {
    id: Date.now(),
    text,
    addedAt: new Date().toISOString(),
    tags: [],
  };
  let db: { memories: ZobodhiFact[] } = { memories: [] };
  try {
    db = JSON.parse(await fs.readFile(ZOBODHI_JSON, "utf8"));
  } catch {}
  db.memories.push(fact);
  await fs.writeFile(ZOBODHI_JSON, JSON.stringify(db, null, 2));
  console.log("✅ Wrote to zobodhi memory.json");

  const doc: ClarionDoc = {
    source: "zobodhi",
    layer: "fact",
    text: fact.text,
    path: ZOBODHI_JSON,
    timestamp: fact.addedAt,
    tags: [],
    project: "general",
    title: fact.text.replace(/\s+/g, " ").slice(0, 80),
  };
  await astra("POST", { insertOne: { document: doc } });
  console.log("☁️  Inserted into Astra memories");
}

async function cmdTail(args: string[]) {
  const n = Math.max(1, parseInt(args[0] || "10", 10));
  const all = await findAll({});
  const sorted = all
    .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
    .slice(0, n);
  console.log(`🕓 Most recent ${sorted.length}:\n`);
  for (const d of sorted) {
    console.log(`  [${d.timestamp?.slice(0, 19) || "?"}] ${d.source} / ${d.title}`);
    console.log(`    ${(d.text || "").replace(/\n+/g, " ").slice(0, 140)}…`);
    console.log();
  }
}

// ---------- Main ----------

const [, , cmd, ...rest] = process.argv;

(async () => {
  try {
    switch (cmd) {
      case "sync":
        await cmdSync(rest);
        break;
      case "status":
        await cmdStatus();
        break;
      case "query":
        await cmdQuery(rest);
        break;
      case "add":
        await cmdAdd(rest);
        break;
      case "tail":
        await cmdTail(rest);
        break;
      default:
        console.log(
          "Usage: sync | status | query <text> | add <fact> | tail [n]"
        );
    }
  } catch (e: any) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
})();
