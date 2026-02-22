/**
 * ZTD API -- List and create cards
 *
 * Deploy to zo.space at: /api/kanban (route_type: api, public: true)
 *
 * IMPORTANT: Update LIB_PATH below to match your skill install location.
 */

import type { Context } from "hono";

// Update this path to point to your installed ztd skill's lib.ts
const LIB_PATH = "/home/workspace/Skills/open-ztd/scripts/lib.ts";

export default async (c: Context) => {
  const method = c.req.method;
  try {
    const lib = await import(LIB_PATH);
    const url = new URL(c.req.url);

    // GET /api/kanban -- list cards
    if (method === "GET") {
      const db = lib.getDb();
      let sql = "SELECT * FROM cards WHERE archived = 0";
      const params: any[] = [];
      const status = url.searchParams.get("status");
      const assignee = url.searchParams.get("assignee");
      const type = url.searchParams.get("type");
      const tag = url.searchParams.get("tag");
      if (status) { sql += " AND status = ?"; params.push(status); }
      if (assignee) { sql += " AND assignee = ?"; params.push(assignee); }
      if (type) { sql += " AND type = ?"; params.push(type); }
      if (tag) { sql += " AND tags LIKE ?"; params.push(`%"${tag}"%`); }
      sql += " ORDER BY sort_order ASC, id ASC";
      const rows = db.prepare(sql).all(...params) as any[];
      db.close();
      return c.json(rows.map((r: any) => ({
        ...r,
        display_id: `${lib.CARD_PREFIX}-${r.id}`,
        tags: r.tags ? JSON.parse(r.tags) : [],
      })));
    }

    // POST /api/kanban -- create card
    if (method === "POST") {
      const body = await c.req.json();
      if (!body.title) return c.json({ error: "title required" }, 400);
      const db = lib.getDb();
      const id = lib.getNextId(db);
      const ts = lib.now();
      const fm = {
        id, title: body.title, status: body.status || "inbox",
        assignee: body.assignee || "user", type: body.type || "task",
        priority: body.priority || "medium", tags: body.tags || [],
        due_date: body.due_date || null, source: body.source || "manual",
        created_at: ts, updated_at: ts, completed_at: null,
        conversations: body.conversation ? [body.conversation] : [],
        attachments: [],
      };
      const card = {
        frontmatter: fm, description: body.description || "",
        comments: [], activity: [`${ts} | ${fm.assignee} | created`],
      };
      lib.writeCard(card);
      lib.indexCard(db, card);
      db.close();
      return c.json({ ok: true, id, display_id: `${lib.CARD_PREFIX}-${id}`, title: fm.title }, 201);
    }

    return c.json({ error: "Method not allowed" }, 405);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
};
