#!/usr/bin/env python3
"""Query tasks.db for the morning briefing.

Returns JSON with overdue tasks, tasks due today, and a count of
undated pending tasks. Requires DuckDB and a tasks table with columns:
id, title, source, priority, due_date, status, context.

If the database doesn't exist, prints an empty result and exits cleanly.
"""

import json
import os
import sys
from datetime import date

DB_PATH = os.environ.get("TASKS_DB", "/home/workspace/Data/tasks.db")

if not os.path.exists(DB_PATH):
    print(json.dumps({
        "date": date.today().isoformat(),
        "overdue": [],
        "due_today": [],
        "pending_no_date": 0,
        "note": f"Database not found at {DB_PATH}"
    }, indent=2))
    sys.exit(0)

import duckdb

con = duckdb.connect(DB_PATH, read_only=True)
today = date.today().isoformat()

overdue = con.execute(
    """SELECT id, title, source, priority, due_date, status, context
       FROM tasks
       WHERE status NOT IN ('done', 'dismissed', 'completed', 'cancelled')
         AND due_date < ?
       ORDER BY
         CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END,
         due_date""",
    [today],
).fetchall()

due_today = con.execute(
    """SELECT id, title, source, priority, due_date, status, context
       FROM tasks
       WHERE status NOT IN ('done', 'dismissed', 'completed', 'cancelled')
         AND due_date = ?
       ORDER BY
         CASE priority WHEN 'p0' THEN 0 WHEN 'p1' THEN 1 WHEN 'p2' THEN 2 ELSE 3 END""",
    [today],
).fetchall()

pending_no_date = con.execute(
    """SELECT COUNT(*) FROM tasks
       WHERE status NOT IN ('done', 'dismissed', 'completed', 'cancelled') AND due_date IS NULL""",
).fetchone()[0]

cols = ["id", "title", "source", "priority", "due_date", "status", "context"]

result = {
    "date": today,
    "overdue": [dict(zip(cols, [str(v) if v is not None else None for v in row])) for row in overdue],
    "due_today": [dict(zip(cols, [str(v) if v is not None else None for v in row])) for row in due_today],
    "pending_no_date": pending_no_date,
}

con.close()
print(json.dumps(result, indent=2))
