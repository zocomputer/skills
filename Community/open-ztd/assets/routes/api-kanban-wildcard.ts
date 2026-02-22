/**
 * ZTD API -- All other endpoints (detail, update, delete, comments, etc.)
 *
 * Deploy to zo.space at: /api/kanban/:path{.+} (route_type: api, public: true)
 *
 * IMPORTANT: Update LIB_PATH below to match your skill install location.
 */

import type { Context } from "hono";
import { readFileSync, existsSync, readdirSync, unlinkSync } from "fs";
import { join, basename } from "path";

// Update this path to point to your installed ztd skill's lib.ts
const LIB_PATH = "/home/workspace/Skills/open-ztd/scripts/lib.ts";

export default async (c: Context) => {
  const method = c.req.method;
  const pathStr = c.req.param("path") || "";
  const parts = pathStr.split("/");

  try {
    const lib = await import(LIB_PATH);

    // -----------------------------------------------------------------------
    // /api/kanban/stats
    // -----------------------------------------------------------------------
    if (parts[0] === "stats" && method === "GET") {
      const db = lib.getDb();
      const statuses = db.prepare("SELECT status, COUNT(*) as count FROM cards WHERE archived = 0 GROUP BY status").all();
      const assignees = db.prepare("SELECT assignee, COUNT(*) as count FROM cards WHERE archived = 0 GROUP BY assignee").all();
      const today = new Date().toISOString().split("T")[0];
      const overdue = db.prepare("SELECT COUNT(*) as count FROM cards WHERE archived = 0 AND due_date IS NOT NULL AND due_date < ? AND status != 'done'").get(today) as { count: number };
      const total = db.prepare("SELECT COUNT(*) as count FROM cards WHERE archived = 0").get() as { count: number };
      db.close();
      return c.json({ total: total.count, overdue: overdue.count, by_status: statuses, by_assignee: assignees });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/reindex
    // -----------------------------------------------------------------------
    if (parts[0] === "reindex" && method === "POST") {
      const db = lib.getDb();
      db.prepare("DELETE FROM cards").run();
      let count = 0, errors = 0, maxId = 0;
      for (const [dir, archived] of [[lib.DATA_DIR, 0], [lib.ARCHIVE_DIR, 1]] as const) {
        for (const file of lib.listCardFiles(dir)) {
          try {
            const content = readFileSync(join(dir, file), "utf-8");
            const card = lib.parseCardFile(content);
            if (archived) {
              const fm = card.frontmatter;
              db.prepare(`INSERT OR REPLACE INTO cards (id,title,status,assignee,type,priority,tags,due_date,source,sort_order,created_at,updated_at,completed_at,archived) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(
                fm.id, fm.title, fm.status, fm.assignee, fm.type, fm.priority, JSON.stringify(fm.tags), fm.due_date, fm.source, 0, fm.created_at, fm.updated_at, fm.completed_at);
            } else {
              lib.indexCard(db, card, count);
            }
            if (card.frontmatter.id > maxId) maxId = card.frontmatter.id;
            count++;
          } catch { errors++; }
        }
      }
      db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES ('next_id', ?)").run(String(maxId + 1));
      db.close();
      return c.json({ reindexed: count, errors, next_id: maxId + 1 });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/reorder
    // -----------------------------------------------------------------------
    if (parts[0] === "reorder" && method === "POST") {
      const body = await c.req.json();
      if (!Array.isArray(body.orders)) return c.json({ error: "orders array required" }, 400);
      const db = lib.getDb();
      const stmt = db.prepare("UPDATE cards SET sort_order = ? WHERE id = ?");
      for (const o of body.orders) stmt.run(o.sort_order, o.id);
      db.close();
      return c.json({ updated: body.orders.length });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/archive
    // -----------------------------------------------------------------------
    if (parts[0] === "archive" && method === "GET") {
      const db = lib.getDb();
      const url = new URL(c.req.url);
      const query = url.searchParams.get("query");
      let sql = "SELECT * FROM cards WHERE archived = 1";
      const params: any[] = [];
      if (query) { sql += " AND title LIKE ?"; params.push(`%${query}%`); }
      sql += " ORDER BY completed_at DESC LIMIT 50";
      const rows = db.prepare(sql).all(...params);
      db.close();
      return c.json(rows);
    }

    // -----------------------------------------------------------------------
    // /api/kanban/:id (numeric)
    // -----------------------------------------------------------------------
    const id = parseInt(parts[0], 10);
    if (isNaN(id)) return c.json({ error: "Not found" }, 404);

    const subRoute = parts[1];

    // -----------------------------------------------------------------------
    // /api/kanban/:id/comments
    // -----------------------------------------------------------------------
    if (subRoute === "comments" && method === "POST") {
      const body = await c.req.json();
      if (!body.content) return c.json({ error: "content required" }, 400);
      const card = lib.readCard(id);
      if (!card) return c.json({ error: "Card not found" }, 404);
      const ts = lib.now();
      const author = body.author || "user";
      card.comments.push({ author, timestamp: ts, content: body.content });
      card.activity.push(`${ts} | ${author} | commented`);
      card.frontmatter.updated_at = ts;
      lib.writeCard(card);
      const db = lib.getDb();
      lib.indexCard(db, card);
      db.close();
      return c.json({ ok: true, comment: { author, timestamp: ts, content: body.content } });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/:id/attachments
    // -----------------------------------------------------------------------
    if (subRoute === "attachments" && method === "POST") {
      const body = await c.req.json();
      if (!body.path) return c.json({ error: "path required" }, 400);
      const card = lib.readCard(id);
      if (!card) return c.json({ error: "Card not found" }, 404);
      const ts = lib.now();
      const author = body.added_by || "user";
      card.frontmatter.attachments.push({
        path: body.path, name: body.name || basename(body.path),
        added_by: author, added_at: ts,
      });
      card.activity.push(`${ts} | ${author} | attached ${body.name || basename(body.path)}`);
      card.frontmatter.updated_at = ts;
      lib.writeCard(card);
      const db = lib.getDb();
      lib.indexCard(db, card);
      db.close();
      return c.json({ ok: true });
    }

    if (subRoute === "attachments" && method === "DELETE") {
      const body = await c.req.json();
      if (!body.path) return c.json({ error: "path required" }, 400);
      const card = lib.readCard(id);
      if (!card) return c.json({ error: "Card not found" }, 404);
      card.frontmatter.attachments = card.frontmatter.attachments.filter((a: any) => a.path !== body.path);
      card.frontmatter.updated_at = lib.now();
      lib.writeCard(card);
      const db = lib.getDb();
      lib.indexCard(db, card);
      db.close();
      return c.json({ ok: true });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/:id/activity
    // -----------------------------------------------------------------------
    if (subRoute === "activity" && method === "GET") {
      const card = lib.readCard(id);
      if (!card) return c.json({ error: "Card not found" }, 404);
      return c.json({ activity: card.activity });
    }

    // -----------------------------------------------------------------------
    // /api/kanban/:id -- card detail / update / delete
    // -----------------------------------------------------------------------
    if (!subRoute) {
      if (method === "GET") {
        const card = lib.readCard(id);
        if (!card) return c.json({ error: "Card not found" }, 404);
        return c.json({
          ...card.frontmatter,
          display_id: `${lib.CARD_PREFIX}-${id}`,
          description: card.description,
          comments: card.comments,
          activity: card.activity,
        });
      }

      if (method === "PATCH") {
        const body = await c.req.json();
        const card = lib.readCard(id);
        if (!card) return c.json({ error: "Card not found" }, 404);
        const fm = card.frontmatter;
        const changes: string[] = [];
        const actor = body.actor || "user";
        if (body.title !== undefined) { fm.title = body.title; changes.push(`title -> ${body.title}`); }
        if (body.status !== undefined) {
          const old = fm.status; fm.status = body.status;
          changes.push(`status: ${old} -> ${body.status}`);
          if (body.status === "done" && !fm.completed_at) fm.completed_at = lib.now();
        }
        if (body.assignee !== undefined) { fm.assignee = body.assignee; changes.push(`assignee -> ${body.assignee}`); }
        if (body.priority !== undefined) { fm.priority = body.priority; changes.push(`priority -> ${body.priority}`); }
        if (body.type !== undefined) { fm.type = body.type; changes.push(`type -> ${body.type}`); }
        if (body.tags !== undefined) { fm.tags = body.tags; changes.push("tags updated"); }
        if (body.due_date !== undefined) { fm.due_date = body.due_date; changes.push(`due_date -> ${body.due_date}`); }
        if (body.description !== undefined) { card.description = body.description; changes.push("description updated"); }
        if (body.conversation) {
          if (!fm.conversations.includes(body.conversation)) fm.conversations.push(body.conversation);
        }
        fm.updated_at = lib.now();
        for (const ch of changes) card.activity.push(`${fm.updated_at} | ${actor} | ${ch}`);
        lib.writeCard(card);
        const db = lib.getDb();
        lib.indexCard(db, card);
        db.close();
        return c.json({ ok: true, changes, card: { ...fm, display_id: `${lib.CARD_PREFIX}-${id}` } });
      }

      if (method === "DELETE") {
        const p1 = lib.cardPath(id);
        const p2 = lib.cardPath(id, true);
        if (existsSync(p1)) unlinkSync(p1);
        else if (existsSync(p2)) unlinkSync(p2);
        else return c.json({ error: "Card not found" }, 404);
        const db = lib.getDb();
        db.prepare("DELETE FROM cards WHERE id = ?").run(id);
        db.close();
        return c.json({ ok: true, deleted: id });
      }
    }

    return c.json({ error: "Not found" }, 404);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
};
