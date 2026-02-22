/**
 * ZTD shared library -- card file parser, serializer, SQLite helpers.
 * Used by both the CLI (ztd.ts) and zo.space API routes (via dynamic import).
 */

import { Database } from "bun:sqlite";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join, basename } from "path";

// ---------------------------------------------------------------------------
// Config -- override with ZTD_DATA_DIR env var
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = process.env.HOME
  ? join(process.env.HOME, "workspace")
  : "/home/workspace";

export const DATA_DIR =
  process.env.ZTD_DATA_DIR || join(WORKSPACE_ROOT, "Data", "ztd");
export const ARCHIVE_DIR = join(DATA_DIR, "archive");
export const DB_PATH = join(DATA_DIR, "index.db");
export const CARD_PREFIX = "ZTD";
export const STALE_DAYS = 7;
export const ARCHIVE_DAYS = 14;

// ---------------------------------------------------------------------------
// Ensure dirs exist
// ---------------------------------------------------------------------------

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardFrontmatter {
  id: number;
  title: string;
  status: string;
  assignee: string;
  type: string;
  priority: string;
  tags: string[];
  due_date: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  conversations: string[];
  attachments: Array<{
    path: string;
    name: string;
    added_by: string;
    added_at: string;
  }>;
}

export interface CardFile {
  frontmatter: CardFrontmatter;
  description: string;
  comments: Array<{ author: string; timestamp: string; content: string }>;
  activity: string[];
}

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

export function getDb(): Database {
  const db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'inbox',
      assignee TEXT NOT NULL,
      type TEXT DEFAULT 'task',
      priority TEXT DEFAULT 'medium',
      tags TEXT,
      due_date TEXT,
      source TEXT DEFAULT 'manual',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      archived INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_status ON cards(status);
    CREATE INDEX IF NOT EXISTS idx_assignee ON cards(assignee);
    CREATE INDEX IF NOT EXISTS idx_type ON cards(type);
    CREATE INDEX IF NOT EXISTS idx_priority ON cards(priority);
    CREATE INDEX IF NOT EXISTS idx_due_date ON cards(due_date);
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const row = db
    .prepare("SELECT value FROM metadata WHERE key = 'next_id'")
    .get() as { value: string } | null;
  if (!row) {
    db.prepare(
      "INSERT INTO metadata (key, value) VALUES ('next_id', '1')"
    ).run();
  }
  return db;
}

export function getNextId(db: Database): number {
  const row = db
    .prepare("SELECT value FROM metadata WHERE key = 'next_id'")
    .get() as { value: string };
  const id = parseInt(row.value, 10);
  db.prepare("UPDATE metadata SET value = ? WHERE key = 'next_id'").run(
    String(id + 1)
  );
  return id;
}

// ---------------------------------------------------------------------------
// YAML Frontmatter parser / serializer
// ---------------------------------------------------------------------------

function parseYamlValue(val: string): any {
  val = val.trim();
  if (val === "null" || val === "") return null;
  if (val === "true") return true;
  if (val === "false") return false;
  if (/^\d+$/.test(val)) return parseInt(val, 10);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
  if (val.startsWith("[") && val.endsWith("]")) {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

function parseFrontmatter(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = raw.split("\n");
  let currentKey = "";
  let currentList: any[] | null = null;
  let currentObj: Record<string, any> | null = null;
  let objList: any[] | null = null;

  for (const line of lines) {
    if (/^  - /.test(line) && currentKey && !currentObj) {
      const val = line.replace(/^  - /, "").trim();
      if (val.includes(": ")) {
        if (!objList) objList = [];
        const [k, ...rest] = val.split(": ");
        currentObj = { [k.trim()]: parseYamlValue(rest.join(": ")) };
      } else {
        if (!currentList) currentList = [];
        currentList.push(parseYamlValue(val));
      }
      continue;
    }

    if (/^    /.test(line) && currentObj) {
      const trimmed = line.trim();
      if (trimmed.includes(": ")) {
        const [k, ...rest] = trimmed.split(": ");
        currentObj[k.trim()] = parseYamlValue(rest.join(": "));
      }
      continue;
    }

    if (/^[a-z_]+:/.test(line)) {
      if (currentKey) {
        if (objList && currentObj) {
          objList.push(currentObj);
          result[currentKey] = objList;
        } else if (currentObj) {
          result[currentKey] = [currentObj];
        } else if (currentList) {
          result[currentKey] = currentList;
        }
      }
      currentList = null;
      currentObj = null;
      objList = null;
      const colonIdx = line.indexOf(":");
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();
      currentKey = key;
      if (val) {
        result[key] = parseYamlValue(val);
        currentList = null;
      }
      continue;
    }
  }

  if (currentKey) {
    if (objList && currentObj) {
      objList.push(currentObj);
      result[currentKey] = objList;
    } else if (currentObj) {
      result[currentKey] = [currentObj];
    } else if (currentList) {
      result[currentKey] = currentList;
    }
  }
  return result;
}

export function serializeFrontmatter(fm: CardFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`id: ${fm.id}`);
  lines.push(`title: ${fm.title}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`assignee: ${fm.assignee}`);
  lines.push(`type: ${fm.type}`);
  lines.push(`priority: ${fm.priority}`);
  lines.push(
    fm.tags && fm.tags.length > 0 ? `tags: ${JSON.stringify(fm.tags)}` : "tags: []"
  );
  lines.push(`due_date: ${fm.due_date || "null"}`);
  lines.push(`source: ${fm.source}`);
  lines.push(`created_at: ${fm.created_at}`);
  lines.push(`updated_at: ${fm.updated_at}`);
  lines.push(`completed_at: ${fm.completed_at || "null"}`);
  if (fm.conversations && fm.conversations.length > 0) {
    lines.push("conversations:");
    for (const c of fm.conversations) lines.push(`  - ${c}`);
  } else {
    lines.push("conversations: []");
  }
  if (fm.attachments && fm.attachments.length > 0) {
    lines.push("attachments:");
    for (const a of fm.attachments) {
      lines.push(`  - path: ${a.path}`);
      lines.push(`    name: ${a.name}`);
      lines.push(`    added_by: ${a.added_by}`);
      lines.push(`    added_at: ${a.added_at}`);
    }
  } else {
    lines.push("attachments: []");
  }
  lines.push("---");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Card file parser
// ---------------------------------------------------------------------------

export function parseCardFile(content: string): CardFile {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error("No frontmatter found");

  const rawFm = parseFrontmatter(fmMatch[1]);
  const fm: CardFrontmatter = {
    id: rawFm.id ?? 0,
    title: rawFm.title ?? "",
    status: rawFm.status ?? "inbox",
    assignee: rawFm.assignee ?? "user",
    type: rawFm.type ?? "task",
    priority: rawFm.priority ?? "medium",
    tags: Array.isArray(rawFm.tags) ? rawFm.tags : [],
    due_date: rawFm.due_date ?? null,
    source: rawFm.source ?? "manual",
    created_at: rawFm.created_at ?? new Date().toISOString(),
    updated_at: rawFm.updated_at ?? new Date().toISOString(),
    completed_at: rawFm.completed_at ?? null,
    conversations: Array.isArray(rawFm.conversations) ? rawFm.conversations : [],
    attachments: Array.isArray(rawFm.attachments) ? rawFm.attachments : [],
  };

  const body = content.slice(fmMatch[0].length).trim();
  let description = "";
  let commentsSection = "";
  let activitySection = "";

  const commentsSplit = body.split("## Comments");
  if (commentsSplit.length > 1) {
    description = commentsSplit[0].trim();
    const rest = commentsSplit[1];
    const activitySplit = rest.split("## Activity");
    if (activitySplit.length > 1) {
      commentsSection = activitySplit[0].trim();
      activitySection = activitySplit[1].trim();
    } else {
      commentsSection = rest.trim();
    }
  } else {
    const activitySplit = body.split("## Activity");
    if (activitySplit.length > 1) {
      description = activitySplit[0].trim();
      activitySection = activitySplit[1].trim();
    } else {
      description = body;
    }
  }

  const comments: Array<{
    author: string;
    timestamp: string;
    content: string;
  }> = [];
  const commentRegex =
    /<!--- comment: (.+?) \| (.+?) --->\n([\s\S]*?)<!--- \/comment --->/g;
  let match;
  while ((match = commentRegex.exec(commentsSection)) !== null) {
    comments.push({
      author: match[1].trim(),
      timestamp: match[2].trim(),
      content: match[3].trim(),
    });
  }

  const activity: string[] = [];
  if (activitySection) {
    for (const line of activitySection.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("- ")) activity.push(trimmed.slice(2));
    }
  }

  return { frontmatter: fm, description, comments, activity };
}

// ---------------------------------------------------------------------------
// Card file writer
// ---------------------------------------------------------------------------

export function serializeCardFile(card: CardFile): string {
  const parts: string[] = [];
  parts.push(serializeFrontmatter(card.frontmatter));
  parts.push("");
  if (card.description) {
    parts.push(card.description);
    parts.push("");
  }
  parts.push("## Comments");
  parts.push("");
  for (const c of card.comments) {
    parts.push(`<!--- comment: ${c.author} | ${c.timestamp} --->`);
    parts.push(c.content);
    parts.push("<!--- /comment --->");
    parts.push("");
  }
  parts.push("## Activity");
  parts.push("");
  for (const a of card.activity) parts.push(`- ${a}`);
  parts.push("");
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

export function cardPath(id: number, archived = false): string {
  const dir = archived ? ARCHIVE_DIR : DATA_DIR;
  return join(dir, `${CARD_PREFIX}-${id}.md`);
}

export function readCard(id: number): CardFile | null {
  let path = cardPath(id);
  if (!existsSync(path)) {
    path = cardPath(id, true);
    if (!existsSync(path)) return null;
  }
  try {
    return parseCardFile(readFileSync(path, "utf-8"));
  } catch (e) {
    console.error(`Warning: Failed to parse ${CARD_PREFIX}-${id}.md: ${e}`);
    return null;
  }
}

export function writeCard(card: CardFile): void {
  const isArchived =
    card.frontmatter.status === "done" &&
    existsSync(cardPath(card.frontmatter.id, true));
  const path = isArchived
    ? cardPath(card.frontmatter.id, true)
    : cardPath(card.frontmatter.id);
  writeFileSync(path, serializeCardFile(card));
}

export function listCardFiles(dir: string = DATA_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.startsWith(`${CARD_PREFIX}-`) && f.endsWith(".md")
  );
}

export function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Index helpers
// ---------------------------------------------------------------------------

export function indexCard(
  db: Database,
  card: CardFile,
  sortOrder?: number
): void {
  const fm = card.frontmatter;
  const existing = db
    .prepare("SELECT id FROM cards WHERE id = ?")
    .get(fm.id) as { id: number } | null;

  if (existing) {
    db.prepare(
      `UPDATE cards SET title=?, status=?, assignee=?, type=?, priority=?, tags=?,
      due_date=?, source=?, sort_order=COALESCE(?, sort_order), created_at=?, updated_at=?,
      completed_at=?, archived=?
      WHERE id=?`
    ).run(
      fm.title,
      fm.status,
      fm.assignee,
      fm.type,
      fm.priority,
      JSON.stringify(fm.tags),
      fm.due_date,
      fm.source,
      sortOrder ?? null,
      fm.created_at,
      fm.updated_at,
      fm.completed_at,
      0,
      fm.id
    );
  } else {
    db.prepare(
      `INSERT INTO cards (id, title, status, assignee, type, priority, tags, due_date,
      source, sort_order, created_at, updated_at, completed_at, archived)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      fm.id,
      fm.title,
      fm.status,
      fm.assignee,
      fm.type,
      fm.priority,
      JSON.stringify(fm.tags),
      fm.due_date,
      fm.source,
      sortOrder ?? 0,
      fm.created_at,
      fm.updated_at,
      fm.completed_at,
      0
    );
  }
}
