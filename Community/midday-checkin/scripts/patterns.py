#!/usr/bin/env python3
"""Pattern detection for midday check-in.

Scans tasks.db, recent meeting records, and commitments for patterns
worth surfacing. Outputs JSON with categorized findings.

Usage:
    python3 patterns.py [--state-file PATH] [--db PATH] [--records-dir PATH]

The state file tracks what was seen last run for delta detection.
"""

import json
import os
import sys
import glob
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = os.environ.get("TASKS_DB", "/home/workspace/Data/tasks.db")
RECORDS_DIR = os.environ.get("RECORDS_DIR", "/home/workspace/Records/Meetings")
DEFAULT_STATE_FILE = "/home/workspace/Data/midday-state.json"


def parse_args():
    state_file = DEFAULT_STATE_FILE
    db_path = DB_PATH
    records_dir = RECORDS_DIR
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--state-file" and i + 1 < len(sys.argv):
            state_file = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--db" and i + 1 < len(sys.argv):
            db_path = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--records-dir" and i + 1 < len(sys.argv):
            records_dir = sys.argv[i + 1]; i += 2
        else:
            i += 1
    return state_file, db_path, records_dir


def load_state(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {"last_run": None, "seen_meetings": [], "task_snapshots": {}}


def save_state(path, state):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(state, f, indent=2, default=str)


def detect_task_patterns(db_path):
    findings = []
    if not os.path.exists(db_path):
        return findings

    try:
        import duckdb
    except ImportError:
        findings.append({
            "type": "setup",
            "severity": "info",
            "message": "DuckDB not installed. Task pattern detection skipped.",
        })
        return findings

    con = duckdb.connect(db_path, read_only=True)

    overdue = con.execute("""
        SELECT id, title, due_date, priority, status, source, context,
               DATEDIFF('day', due_date, CURRENT_DATE) as days_overdue
        FROM tasks
        WHERE status NOT IN ('completed', 'cancelled', 'done', 'dismissed')
          AND due_date < CURRENT_DATE
        ORDER BY due_date ASC
    """).fetchall()

    for row in overdue:
        id, title, due_date, priority, status, source, context, days_overdue = row
        if days_overdue >= 3:
            findings.append({
                "type": "task_aging",
                "severity": "high" if days_overdue >= 7 else "medium",
                "message": f"'{title}' is {days_overdue} days overdue (due {due_date}, priority {priority})",
                "task_id": id,
                "days_overdue": days_overdue,
            })

    stale = con.execute("""
        SELECT id, title, status, priority, updated_at,
               DATEDIFF('day', updated_at, CURRENT_TIMESTAMP) as days_stale
        FROM tasks
        WHERE status IN ('pending', 'in_progress')
          AND DATEDIFF('day', updated_at, CURRENT_TIMESTAMP) >= 5
        ORDER BY updated_at ASC
    """).fetchall()

    for row in stale:
        id, title, status, priority, updated_at, days_stale = row
        findings.append({
            "type": "task_stale",
            "severity": "medium",
            "message": f"'{title}' ({status}) hasn't been updated in {days_stale} days",
            "task_id": id,
            "days_stale": days_stale,
        })

    in_progress = con.execute("""
        SELECT count(*) FROM tasks WHERE status = 'in_progress'
    """).fetchone()[0]
    if in_progress > 5:
        findings.append({
            "type": "wip_overload",
            "severity": "medium",
            "message": f"{in_progress} tasks are in-progress simultaneously. That's a lot of open threads.",
        })

    # Commitment drift detection (requires decisions table)
    try:
        recent_decisions = con.execute("""
            SELECT id, title, context, source, decided_at
            FROM decisions
            WHERE decided_at >= CURRENT_DATE - INTERVAL 7 DAY
            ORDER BY decided_at DESC
        """).fetchall()

        for row in recent_decisions:
            id, title, context, source, decided_at = row
            title_lower = (title or "").lower()
            context_lower = (context or "").lower()
            if any(kw in title_lower or kw in context_lower for kw in ["will", "commit", "by", "deadline", "deliver"]):
                findings.append({
                    "type": "commitment_check",
                    "severity": "info",
                    "message": f"Recent commitment: '{title}' (decided {decided_at}). Worth checking progress.",
                    "decision_id": id,
                })
    except Exception:
        pass  # decisions table may not exist

    con.close()
    return findings


def detect_meeting_patterns(records_dir):
    findings = []
    if not os.path.isdir(records_dir):
        return findings

    files = sorted(glob.glob(os.path.join(records_dir, "*.md")), reverse=True)
    recent_files = files[:30]

    participant_counts = {}
    meeting_dates = []

    for filepath in recent_files:
        try:
            with open(filepath) as f:
                content = f.read()
        except Exception:
            continue

        lines = content.split("\n")
        date_str = None
        participants = []
        for line in lines:
            if line.startswith("date:"):
                date_str = line.split(":", 1)[1].strip()
            if line.startswith("participants:"):
                try:
                    participants = json.loads(line.split(":", 1)[1].strip())
                except Exception:
                    pass

        if date_str:
            meeting_dates.append(date_str)

        for p in participants:
            if p and len(p) > 2:
                name = p.split("@")[0] if "@" in p and len(p.split("@")[0]) > 2 else p
                if len(name) > 2:
                    participant_counts[name] = participant_counts.get(name, 0) + 1

    now = datetime.now()
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    two_weeks_ago = (now - timedelta(days=14)).strftime("%Y-%m-%d")

    this_week = sum(1 for d in meeting_dates if d >= week_ago)
    last_week = sum(1 for d in meeting_dates if two_weeks_ago <= d < week_ago)

    if this_week > 0 and last_week > 0:
        if this_week >= last_week * 1.5:
            findings.append({
                "type": "meeting_load",
                "severity": "low",
                "message": f"Meeting volume is up: {this_week} this week vs {last_week} last week.",
            })

    for name, count in sorted(participant_counts.items(), key=lambda x: -x[1]):
        if count >= 4:
            findings.append({
                "type": "frequent_contact",
                "severity": "info",
                "message": f"You've had {count} meetings with {name} in recent records.",
            })

    return findings


def get_new_meetings(state, records_dir):
    findings = []
    if not os.path.isdir(records_dir):
        return findings, []

    seen = set(state.get("seen_meetings", []))
    files = glob.glob(os.path.join(records_dir, "*.md"))

    for filepath in sorted(files):
        basename = os.path.basename(filepath)
        if basename not in seen and not basename.startswith("."):
            findings.append({
                "type": "new_meeting_record",
                "severity": "info",
                "message": f"New meeting record since last check: {basename}",
                "file": basename,
            })

    all_basenames = [os.path.basename(f) for f in files if not os.path.basename(f).startswith(".")]
    return findings, all_basenames


def main():
    state_file, db_path, records_dir = parse_args()
    state = load_state(state_file)

    all_findings = []

    task_findings = detect_task_patterns(db_path)
    all_findings.extend(task_findings)

    meeting_findings = detect_meeting_patterns(records_dir)
    all_findings.extend(meeting_findings)

    new_meeting_findings, all_meeting_files = get_new_meetings(state, records_dir)
    all_findings.extend(new_meeting_findings)

    high = [f for f in all_findings if f.get("severity") == "high"]
    medium = [f for f in all_findings if f.get("severity") == "medium"]
    low = [f for f in all_findings if f.get("severity") in ("low", "info")]

    output = {
        "timestamp": datetime.now().isoformat(),
        "summary": {
            "high": len(high),
            "medium": len(medium),
            "low": len(low),
            "total": len(all_findings),
        },
        "findings": all_findings,
    }

    state["last_run"] = datetime.now().isoformat()
    state["seen_meetings"] = all_meeting_files
    save_state(state_file, state)

    print(json.dumps(output, indent=2, default=str))


if __name__ == "__main__":
    main()
