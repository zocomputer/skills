#!/usr/bin/env bun
/**
 * ZTD (Zo To Do) -- CLI tool for a file-first task board.
 *
 * Cards are markdown files in Data/ztd/ (source of truth).
 * SQLite index at Data/ztd/index.db is a derived cache for fast queries.
 *
 * Usage: bun run Skills/open-ztd/scripts/ztd.ts <command> [options]
 */

import { Database } from "bun:sqlite";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  mkdirSync,
  renameSync,
  unlinkSync,
} from "fs";
import { join, basename } from "path";

// ---------------------------------------------------------------------------
// Config -- override with ZTD_DATA_DIR env var
// ---------------------------------------------------------------------------

const WORKSPACE_ROOT = process.env.HOME
  ? join(process.env.HOME, "workspace")
  : "/home/workspace";

const DATA_DIR =
  process.env.ZTD_DATA_DIR || join(WORKSPACE_ROOT, "Data", "ztd");
const ARCHIVE_DIR = join(DATA_DIR, "archive");
const DB_PATH = join(DATA_DIR, "index.db");
const CARD_PREFIX = "ZTD";
const STALE_DAYS = 7;
const ARCHIVE_DAYS = 14;

// ---------------------------------------------------------------------------
// Ensure dirs exist
// ---------------------------------------------------------------------------

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(ARCHIVE_DIR)) mkdirSync(ARCHIVE_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// SQLite helpers
// ---------------------------------------------------------------------------

function getDb(): Database {
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

function getNextId(db: Database): number {
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
// YAML Frontmatter parser / serializer (minimal, no deps)
// ---------------------------------------------------------------------------

interface CardFrontmatter {
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

interface CardFile {
  frontmatter: CardFrontmatter;
  description: string;
  comments: Array<{ author: string; timestamp: string; content: string }>;
  activity: string[];
}

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
        currentKey = key;
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

function serializeYamlValue(val: any): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return String(val);
  if (typeof val === "number") return String(val);
  if (Array.isArray(val) && val.length === 0) return "[]";
  return String(val);
}

function serializeFrontmatter(fm: CardFrontmatter): string {
  const lines: string[] = ["---"];

  lines.push(`id: ${fm.id}`);
  lines.push(`title: ${fm.title}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`assignee: ${fm.assignee}`);
  lines.push(`type: ${fm.type}`);
  lines.push(`priority: ${fm.priority}`);

  if (fm.tags && fm.tags.length > 0) {
    lines.push(`tags: ${JSON.stringify(fm.tags)}`);
  } else {
    lines.push("tags: []");
  }

  lines.push(`due_date: ${fm.due_date || "null"}`);
  lines.push(`source: ${fm.source}`);
  lines.push(`created_at: ${fm.created_at}`);
  lines.push(`updated_at: ${fm.updated_at}`);
  lines.push(`completed_at: ${fm.completed_at || "null"}`);

  if (fm.conversations && fm.conversations.length > 0) {
    lines.push("conversations:");
    for (const c of fm.conversations) {
      lines.push(`  - ${c}`);
    }
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

function parseCardFile(content: string): CardFile {
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
    conversations: Array.isArray(rawFm.conversations)
      ? rawFm.conversations
      : [],
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
      if (trimmed.startsWith("- ")) {
        activity.push(trimmed.slice(2));
      }
    }
  }

  return { frontmatter: fm, description, comments, activity };
}

// ---------------------------------------------------------------------------
// Card file writer
// ---------------------------------------------------------------------------

function serializeCardFile(card: CardFile): string {
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
  for (const a of card.activity) {
    parts.push(`- ${a}`);
  }
  parts.push("");

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

function cardPath(id: number, archived = false): string {
  const dir = archived ? ARCHIVE_DIR : DATA_DIR;
  return join(dir, `${CARD_PREFIX}-${id}.md`);
}

function readCard(id: number): CardFile | null {
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

function writeCard(card: CardFile): void {
  const isArchived =
    card.frontmatter.status === "done" &&
    existsSync(cardPath(card.frontmatter.id, true));
  const path = isArchived
    ? cardPath(card.frontmatter.id, true)
    : cardPath(card.frontmatter.id);
  writeFileSync(path, serializeCardFile(card));
}

function listCardFiles(dir: string = DATA_DIR): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(
    (f) => f.startsWith(`${CARD_PREFIX}-`) && f.endsWith(".md")
  );
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Index helpers
// ---------------------------------------------------------------------------

function indexCard(db: Database, card: CardFile, sortOrder?: number): void {
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

// ---------------------------------------------------------------------------
// CLI argument parser
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string>;
} {
  const command = args[0] || "help";
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(args[i]);
    }
  }

  return { command, positional, flags };
}

function parseId(val: string): number {
  const cleaned = val.replace(/^ZTD-/i, "");
  const id = parseInt(cleaned, 10);
  if (isNaN(id)) {
    console.error(`Invalid ID: ${val}. Use a number or ZTD-N format.`);
    process.exit(1);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdAdd(flags: Record<string, string>): void {
  if (!flags.title) {
    console.error("Error: --title is required");
    process.exit(1);
  }

  const db = getDb();
  const id = getNextId(db);
  const timestamp = now();

  const fm: CardFrontmatter = {
    id,
    title: flags.title,
    status: "inbox",
    assignee: flags.assignee || "user",
    type: flags.type || "task",
    priority: flags.priority || "medium",
    tags: flags.tags ? flags.tags.split(",").map((t) => t.trim()) : [],
    due_date: flags["due-date"] || null,
    source: flags.source || "manual",
    created_at: timestamp,
    updated_at: timestamp,
    completed_at: null,
    conversations: flags.conversation ? [flags.conversation] : [],
    attachments: [],
  };

  const card: CardFile = {
    frontmatter: fm,
    description: flags.description || "",
    comments: [],
    activity: [`${timestamp} | ${fm.assignee} | created`],
  };

  writeCard(card);
  indexCard(db, card);
  db.close();

  console.log(`Created ${CARD_PREFIX}-${id}: ${fm.title}`);
}

function cmdList(flags: Record<string, string>): void {
  const db = getDb();
  let query = "SELECT * FROM cards WHERE archived = 0";
  const params: any[] = [];

  if (flags.status) {
    query += " AND status = ?";
    params.push(flags.status);
  }
  if (flags.assignee) {
    query += " AND assignee = ?";
    params.push(flags.assignee);
  }
  if (flags.type) {
    query += " AND type = ?";
    params.push(flags.type);
  }
  if (flags.tag) {
    query += " AND tags LIKE ?";
    params.push(`%"${flags.tag}"%`);
  }

  query += " ORDER BY sort_order ASC, id ASC";

  const rows = db.prepare(query).all(...params) as any[];
  db.close();

  if (rows.length === 0) {
    console.log("No cards found.");
    return;
  }

  const priorityColors: Record<string, string> = {
    urgent: "\x1b[31m",
    high: "\x1b[33m",
    medium: "\x1b[0m",
    low: "\x1b[2m",
  };
  const reset = "\x1b[0m";

  for (const row of rows) {
    const pColor = priorityColors[row.priority] || "";
    const tags = row.tags ? JSON.parse(row.tags).join(", ") : "";
    const tagStr = tags ? ` [${tags}]` : "";
    const dueStr = row.due_date ? ` (due: ${row.due_date})` : "";
    console.log(
      `${pColor}${CARD_PREFIX}-${row.id}  ${row.status.padEnd(12)} ${row.assignee.padEnd(8)} ${row.type.padEnd(10)} ${row.priority.padEnd(8)} ${row.title}${tagStr}${dueStr}${reset}`
    );
  }
}

function cmdUpdate(
  positional: string[],
  flags: Record<string, string>
): void {
  if (positional.length === 0) {
    console.error(
      "Error: card ID required. Usage: ztd update <id> [--field value]"
    );
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const card = readCard(id);
  if (!card) {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  const fm = card.frontmatter;
  const oldStatus = fm.status;
  const changes: string[] = [];
  const actor = flags.actor || fm.assignee;

  if (flags.title) {
    fm.title = flags.title;
    changes.push(`title -> ${flags.title}`);
  }
  if (flags.status) {
    fm.status = flags.status;
    changes.push(`status: ${oldStatus} -> ${flags.status}`);
    if (flags.status === "done" && !fm.completed_at) {
      fm.completed_at = now();
    }
  }
  if (flags.assignee) {
    fm.assignee = flags.assignee;
    changes.push(`assignee -> ${flags.assignee}`);
  }
  if (flags.priority) {
    fm.priority = flags.priority;
    changes.push(`priority -> ${flags.priority}`);
  }
  if (flags.type) {
    fm.type = flags.type;
    changes.push(`type -> ${flags.type}`);
  }
  if (flags.tags) {
    fm.tags = flags.tags.split(",").map((t) => t.trim());
    changes.push(`tags -> ${flags.tags}`);
  }
  if (flags["due-date"]) {
    fm.due_date = flags["due-date"];
    changes.push(`due_date -> ${flags["due-date"]}`);
  }

  fm.updated_at = now();

  for (const change of changes) {
    card.activity.push(`${fm.updated_at} | ${actor} | ${change}`);
  }

  writeCard(card);
  const db = getDb();
  indexCard(db, card);
  db.close();

  console.log(`Updated ${CARD_PREFIX}-${id}: ${changes.join(", ")}`);
}

function cmdMove(positional: string[], flags: Record<string, string>): void {
  if (positional.length < 2) {
    console.error("Error: Usage: ztd move <id> <status>");
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const newStatus = positional[1];
  const validStatuses = ["inbox", "in_progress", "in_review", "done"];
  if (!validStatuses.includes(newStatus)) {
    console.error(
      `Error: Invalid status "${newStatus}". Valid: ${validStatuses.join(", ")}`
    );
    process.exit(1);
  }

  const card = readCard(id);
  if (!card) {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  const oldStatus = card.frontmatter.status;
  const actor = flags.actor || card.frontmatter.assignee;
  card.frontmatter.status = newStatus;
  card.frontmatter.updated_at = now();
  if (newStatus === "done" && !card.frontmatter.completed_at) {
    card.frontmatter.completed_at = now();
  }
  card.activity.push(
    `${card.frontmatter.updated_at} | ${actor} | status: ${oldStatus} -> ${newStatus}`
  );

  writeCard(card);
  const db = getDb();
  indexCard(db, card);
  db.close();

  console.log(`${CARD_PREFIX}-${id}: ${oldStatus} -> ${newStatus}`);
}

function cmdDone(positional: string[], flags: Record<string, string>): void {
  if (positional.length === 0) {
    console.error("Error: card ID required.");
    process.exit(1);
  }
  cmdMove([positional[0], "done"], flags);
}

function cmdDelete(positional: string[]): void {
  if (positional.length === 0) {
    console.error("Error: card ID required.");
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const path = cardPath(id);
  const archivePath = cardPath(id, true);

  if (existsSync(path)) {
    unlinkSync(path);
  } else if (existsSync(archivePath)) {
    unlinkSync(archivePath);
  } else {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  const db = getDb();
  db.prepare("DELETE FROM cards WHERE id = ?").run(id);
  db.close();

  console.log(`Deleted ${CARD_PREFIX}-${id}`);
}

function cmdComment(
  positional: string[],
  flags: Record<string, string>
): void {
  if (positional.length === 0 || !flags.content) {
    console.error(
      "Error: Usage: ztd comment <id> --content '...' [--author user]"
    );
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const card = readCard(id);
  if (!card) {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  const author = flags.author || "user";
  const timestamp = now();

  card.comments.push({ author, timestamp, content: flags.content });
  card.activity.push(`${timestamp} | ${author} | commented`);
  card.frontmatter.updated_at = timestamp;

  writeCard(card);
  const db = getDb();
  indexCard(db, card);
  db.close();

  console.log(`Comment added to ${CARD_PREFIX}-${id}`);
}

function cmdAttach(
  positional: string[],
  flags: Record<string, string>
): void {
  if (positional.length === 0 || !flags.file) {
    console.error(
      "Error: Usage: ztd attach <id> --file 'path' [--name 'Name']"
    );
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const card = readCard(id);
  if (!card) {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  const author = flags.author || "user";
  const timestamp = now();
  card.frontmatter.attachments.push({
    path: flags.file,
    name: flags.name || basename(flags.file),
    added_by: author,
    added_at: timestamp,
  });
  card.activity.push(
    `${timestamp} | ${author} | attached ${flags.name || basename(flags.file)}`
  );
  card.frontmatter.updated_at = timestamp;

  writeCard(card);
  const db = getDb();
  indexCard(db, card);
  db.close();

  console.log(`Attachment added to ${CARD_PREFIX}-${id}: ${flags.file}`);
}

function cmdLink(
  positional: string[],
  flags: Record<string, string>
): void {
  if (positional.length === 0 || !flags.conversation) {
    console.error(
      "Error: Usage: ztd link <id> --conversation <conversation_id>"
    );
    process.exit(1);
  }

  const id = parseId(positional[0]);
  const card = readCard(id);
  if (!card) {
    console.error(`Card ${CARD_PREFIX}-${id} not found.`);
    process.exit(1);
  }

  if (!card.frontmatter.conversations.includes(flags.conversation)) {
    card.frontmatter.conversations.push(flags.conversation);
    card.frontmatter.updated_at = now();
    writeCard(card);
  }

  console.log(
    `Linked conversation ${flags.conversation} to ${CARD_PREFIX}-${id}`
  );
}

function cmdStats(): void {
  const db = getDb();
  const statuses = db
    .prepare(
      "SELECT status, COUNT(*) as count FROM cards WHERE archived = 0 GROUP BY status"
    )
    .all() as Array<{ status: string; count: number }>;

  const assignees = db
    .prepare(
      "SELECT assignee, COUNT(*) as count FROM cards WHERE archived = 0 GROUP BY assignee"
    )
    .all() as Array<{ assignee: string; count: number }>;

  const overdue = db
    .prepare(
      "SELECT COUNT(*) as count FROM cards WHERE archived = 0 AND due_date IS NOT NULL AND due_date < ? AND status != 'done'"
    )
    .get(new Date().toISOString().split("T")[0]) as { count: number };

  const total = db
    .prepare("SELECT COUNT(*) as count FROM cards WHERE archived = 0")
    .get() as { count: number };

  db.close();

  console.log(`\nBoard Stats`);
  console.log(`-----------`);
  console.log(`Total active: ${total.count}`);
  console.log(`Overdue: ${overdue.count}`);
  console.log(`\nBy status:`);
  for (const s of statuses) {
    console.log(`  ${s.status.padEnd(14)} ${s.count}`);
  }
  console.log(`\nBy assignee:`);
  for (const a of assignees) {
    console.log(`  ${a.assignee.padEnd(14)} ${a.count}`);
  }
}

function cmdReview(flags: Record<string, string>): void {
  const db = getDb();
  const assignee = flags.assignee || null;
  let sql =
    "SELECT * FROM cards WHERE archived = 0 AND status = 'in_review'";
  const params: any[] = [];
  if (assignee) {
    sql += " AND assignee = ?";
    params.push(assignee);
  }
  sql += " ORDER BY priority DESC, id ASC";
  const rows = db.prepare(sql).all(...params) as any[];
  db.close();

  if (rows.length === 0) {
    console.log("No items in review.");
    return;
  }

  console.log(`\nIn Review: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `  ${CARD_PREFIX}-${row.id}  ${row.assignee.padEnd(8)} ${row.priority.padEnd(8)} ${row.title}`
    );
  }
}

function cmdOverdue(): void {
  const db = getDb();
  const today = new Date().toISOString().split("T")[0];
  const rows = db
    .prepare(
      "SELECT * FROM cards WHERE archived = 0 AND due_date IS NOT NULL AND due_date < ? AND status != 'done' ORDER BY due_date ASC"
    )
    .all(today) as any[];
  db.close();

  if (rows.length === 0) {
    console.log("No overdue items.");
    return;
  }

  console.log(`\nOverdue: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `  ${CARD_PREFIX}-${row.id}  ${row.due_date}  ${row.assignee.padEnd(8)} ${row.title}`
    );
  }
}

function cmdInbox(): void {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT * FROM cards WHERE archived = 0 AND status = 'inbox' ORDER BY id DESC"
    )
    .all() as any[];
  db.close();

  if (rows.length === 0) {
    console.log("Inbox is empty.");
    return;
  }

  console.log(`\nInbox: ${rows.length}`);
  for (const row of rows) {
    const typeStr = row.type !== "task" ? ` (${row.type})` : "";
    console.log(
      `  ${CARD_PREFIX}-${row.id}  ${row.assignee.padEnd(8)} ${row.priority.padEnd(8)} ${row.title}${typeStr}`
    );
  }
}

function cmdStale(): void {
  const db = getDb();
  const cutoff = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const rows = db
    .prepare(
      "SELECT * FROM cards WHERE archived = 0 AND status IN ('inbox', 'in_progress') AND updated_at < ? ORDER BY updated_at ASC"
    )
    .all(cutoff) as any[];
  db.close();

  if (rows.length === 0) {
    console.log("No stale items.");
    return;
  }

  console.log(`\nStale (no update in ${STALE_DAYS}+ days): ${rows.length}`);
  for (const row of rows) {
    const daysAgo = Math.floor(
      (Date.now() - new Date(row.updated_at).getTime()) / (24 * 60 * 60 * 1000)
    );
    console.log(
      `  ${CARD_PREFIX}-${row.id}  ${row.status.padEnd(14)} ${daysAgo}d ago  ${row.title}`
    );
  }
}

function cmdRead(positional: string[]): void {
  if (positional.length === 0) {
    console.error("Error: card ID required.");
    process.exit(1);
  }

  const id = parseId(positional[0]);
  let path = cardPath(id);
  if (!existsSync(path)) {
    path = cardPath(id, true);
    if (!existsSync(path)) {
      console.error(`Card ${CARD_PREFIX}-${id} not found.`);
      process.exit(1);
    }
  }

  console.log(readFileSync(path, "utf-8"));
}

function cmdReindex(): void {
  const db = getDb();

  db.prepare("DELETE FROM cards").run();

  let count = 0;
  let errors = 0;
  let maxId = 0;

  for (const file of listCardFiles(DATA_DIR)) {
    try {
      const content = readFileSync(join(DATA_DIR, file), "utf-8");
      const card = parseCardFile(content);
      indexCard(db, card, count);
      if (card.frontmatter.id > maxId) maxId = card.frontmatter.id;
      count++;
    } catch (e) {
      console.error(`Warning: Skipping ${file}: ${e}`);
      errors++;
    }
  }

  for (const file of listCardFiles(ARCHIVE_DIR)) {
    try {
      const content = readFileSync(join(ARCHIVE_DIR, file), "utf-8");
      const card = parseCardFile(content);
      const fm = card.frontmatter;
      db.prepare(
        `INSERT OR REPLACE INTO cards (id,title,status,assignee,type,priority,tags,due_date,
        source,sort_order,created_at,updated_at,completed_at,archived)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`
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
        0,
        fm.created_at,
        fm.updated_at,
        fm.completed_at
      );
      if (fm.id > maxId) maxId = fm.id;
      count++;
    } catch (e) {
      console.error(`Warning: Skipping archived ${file}: ${e}`);
      errors++;
    }
  }

  db.prepare(
    "UPDATE metadata SET value = ? WHERE key = 'next_id'"
  ).run(String(maxId + 1));

  db.close();
  console.log(
    `Reindexed ${count} cards (${errors} errors). Next ID: ${maxId + 1}`
  );
}

function cmdArchiveSearch(flags: Record<string, string>): void {
  const db = getDb();
  let query = "SELECT * FROM cards WHERE archived = 1";
  const params: any[] = [];

  if (flags.query) {
    query += " AND title LIKE ?";
    params.push(`%${flags.query}%`);
  }

  query += " ORDER BY completed_at DESC LIMIT 50";

  const rows = db.prepare(query).all(...params) as any[];
  db.close();

  if (rows.length === 0) {
    console.log("No archived cards found.");
    return;
  }

  console.log(`\nArchived cards: ${rows.length}`);
  for (const row of rows) {
    console.log(
      `  ${CARD_PREFIX}-${row.id}  ${row.completed_at?.split("T")[0] || "?"}  ${row.title}`
    );
  }
}

function cmdHelp(): void {
  console.log(`
ZTD (Zo To Do) -- File-first task board CLI

Commands:
  ztd add --title "..." [--assignee user] [--type ...] [--priority ...] [--tags ...] [--due-date ...] [--description ...] [--source ...] [--conversation ...]
  ztd list [--status ...] [--assignee ...] [--type ...] [--tag ...]
  ztd update <id> [--title ...] [--status ...] [--assignee ...] [--priority ...] [--type ...] [--tags ...] [--due-date ...] [--actor ...]
  ztd move <id> <status> [--actor ...]
  ztd done <id> [--actor ...]
  ztd delete <id>
  ztd comment <id> --content "..." [--author ...]
  ztd attach <id> --file "..." [--name "..."] [--author ...]
  ztd link <id> --conversation <id>
  ztd read <id>
  ztd stats
  ztd review [--assignee ...]
  ztd overdue
  ztd inbox
  ztd stale
  ztd archive [--query "..."]
  ztd reindex
  ztd help

Environment:
  ZTD_DATA_DIR    Override default data directory (default: ~/workspace/Data/ztd)
`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const { command, positional, flags } = parseArgs(args);

switch (command) {
  case "add":
    cmdAdd(flags);
    break;
  case "list":
    cmdList(flags);
    break;
  case "update":
    cmdUpdate(positional, flags);
    break;
  case "move":
    cmdMove(positional, flags);
    break;
  case "done":
    cmdDone(positional, flags);
    break;
  case "delete":
    cmdDelete(positional);
    break;
  case "comment":
    cmdComment(positional, flags);
    break;
  case "attach":
    cmdAttach(positional, flags);
    break;
  case "link":
    cmdLink(positional, flags);
    break;
  case "stats":
    cmdStats();
    break;
  case "review":
    cmdReview(flags);
    break;
  case "overdue":
    cmdOverdue();
    break;
  case "inbox":
    cmdInbox();
    break;
  case "stale":
    cmdStale();
    break;
  case "read":
    cmdRead(positional);
    break;
  case "archive":
    cmdArchiveSearch(flags);
    break;
  case "reindex":
    cmdReindex();
    break;
  case "help":
  default:
    cmdHelp();
    break;
}
