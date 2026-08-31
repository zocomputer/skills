#!/usr/bin/env python3
"""
Canvas LMS CLI - Full-featured Canvas API client using secrets.
Reads CANVAS_API_KEY and CANVAS_URL from environment (set in Zo Secrets).
"""

import argparse
import json
import os
import sys
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

# ── Config ──────────────────────────────────────────────────────────────────

API_KEY = os.environ.get("CANVAS_API_KEY")
API_BASE = os.environ.get("CANVAS_URL", "").rstrip("/") + "/api/v1"

if not API_KEY or not API_BASE:
    print("ERROR: Set CANVAS_API_KEY and CANVAS_URL in Zo Secrets.", file=sys.stderr)
    sys.exit(1)

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

# ── HTTP Helpers ─────────────────────────────────────────────────────────────

def api_url(path: str) -> str:
    return f"{API_BASE}{path}"

def build_qs(params: dict | None) -> str:
    """Build URL-encoded query string with proper array support."""
    if not params:
        return ""
    return urlencode(sorted(params.items()), doseq=True)

def get(path: str, params: dict | None = None) -> list | dict:
    url = api_url(path)
    qs = build_qs(params)
    if qs:
        url = f"{url}?{qs}"
    req = Request(url, headers=HEADERS)
    try:
        resp = urlopen(req, timeout=10)
        return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} on GET {url}\n{body}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"Network error on GET {url}: {e}", file=sys.stderr)
        sys.exit(1)

def post(path: str, data: dict | None = None) -> dict:
    body = json.dumps(data or {}).encode() if data else None
    req = Request(api_url(path), data=body, headers=HEADERS, method="POST")
    try:
        resp = urlopen(req, timeout=10)
        return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} on POST {path}\n{body}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"Network error on POST {path}: {e}", file=sys.stderr)
        sys.exit(1)

def put(path: str, data: dict | None = None) -> dict:
    body = json.dumps(data or {}).encode() if data else None
    req = Request(api_url(path), data=body, headers=HEADERS, method="PUT")
    try:
        resp = urlopen(req, timeout=10)
        return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} on PUT {path}\n{body}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"Network error on PUT {path}: {e}", file=sys.stderr)
        sys.exit(1)

def delete(path: str) -> dict | None:
    req = Request(api_url(path), headers=HEADERS, method="DELETE")
    try:
        resp = urlopen(req, timeout=10)
        return json.loads(resp.read()) if resp.status != 204 else None
    except HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"HTTP {e.code} on DELETE {path}\n{body}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"Network error on DELETE {path}: {e}", file=sys.stderr)
        sys.exit(1)

def paginate(path: str, params: dict | None = None) -> list:
    """Fetch all pages of a list endpoint."""
    params = dict(params or {})
    params["per_page"] = 100
    all_items = []
    url = api_url(path)
    while True:
        qs = build_qs(params)
        req_url = f"{url}?{qs}" if qs else url
        req = Request(req_url, headers=HEADERS)
        try:
            resp = urlopen(req, timeout=10)
            items = json.loads(resp.read())
            all_items.extend(items)
            # Check Link header for next page
            link = resp.headers.get("Link", "")
            next_match = re.search(r'<([^>]+)>;\s*rel="next"', link)
            if not next_match:
                break
            # Use the URL from Link header directly — it already contains all params
            url = next_match.group(1)
            # Clear params so we don't re-append them (URL already has everything)
            params = {}
        except HTTPError as e:
            body = e.read().decode(errors="replace")
            print(f"HTTP {e.code} on GET {req_url}\n{body}", file=sys.stderr)
            sys.exit(1)
        except URLError as e:
            print(f"Network error on GET {req_url}: {e}", file=sys.stderr)
            sys.exit(1)
    return all_items

# ── Commands ─────────────────────────────────────────────────────────────────

def cmd_courses(args):
    if args.course_id:
        r = get(f"/courses/{args.course_id}", {"include": args.include})
        print(json.dumps(r, indent=2))
    else:
        courses = paginate("/courses")
        print(json.dumps(courses, indent=2))

def cmd_enrollments(args):
    items = paginate(f"/courses/{args.course_id}/enrollments", {"type": args.type, "state": args.state})
    print(json.dumps(items, indent=2))

def cmd_assignments(args):
    if args.assignment_id:
        r = get(f"/courses/{args.course_id}/assignments/{args.assignment_id}")
        print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/assignments", {"name": args.name, "description": args.description or "", "points_possible": args.points, "due_at": args.due_at or None, "submission_types": ["online_text_entry"]})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/assignments")
        print(json.dumps(items, indent=2))

def cmd_submissions(args):
    if args.student_id and args.assignment_id:
        r = get(f"/courses/{args.course_id}/students/{args.student_id}/submissions/{args.assignment_id}")
    elif args.student_id:
        r = get(f"/courses/{args.course_id}/students/{args.student_id}/submissions", {"assignment_ids": args.assignment_id, "graded": args.graded})
    else:
        r = paginate(f"/courses/{args.course_id}/students/submissions", {"assignment_ids": args.assignment_ids or None, "graded": args.graded})
    print(json.dumps(r, indent=2))

def cmd_grades(args):
    r = get(f"/courses/{args.course_id}/grades/{args.user_id}")
    print(json.dumps(r, indent=2))

def cmd_announcements(args):
    if args.announcement_id:
        r = get(f"/courses/{args.course_id}/announcements/{args.announcement_id}")
        print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/announcements", {"title": args.title, "message": args.message})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/announcements")
        print(json.dumps(items, indent=2))

def cmd_modules(args):
    if args.module_id:
        if args.add_item:
            r = post(f"/courses/{args.course_id}/modules/{args.module_id}/items", {"title": args.title, "type": args.item_type, "content_id": args.content_id or None})
            print(json.dumps(r, indent=2))
        else:
            r = get(f"/courses/{args.course_id}/modules/{args.module_id}")
            print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/modules", {"name": args.name, "position": args.position})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/modules")
        print(json.dumps(items, indent=2))

def cmd_discussions(args):
    if args.topic_id:
        r = get(f"/courses/{args.course_id}/discussion_topics/{args.topic_id}")
        print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/discussion_topics", {"title": args.title, "message": args.message})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/discussion_topics")
        print(json.dumps(items, indent=2))

def cmd_files(args):
    if args.file_id:
        r = get(f"/courses/{args.course_id}/files/{args.file_id}")
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/files")
        print(json.dumps(items, indent=2))

def cmd_quizzes(args):
    if args.quiz_id:
        r = get(f"/courses/{args.course_id}/quizzes/{args.quiz_id}")
        print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/quizzes", {"title": args.title, "description": args.description or ""})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/quizzes")
        print(json.dumps(items, indent=2))

def cmd_pages(args):
    if args.url:
        r = get(f"/courses/{args.course_id}/pages/{args.url}")
        print(json.dumps(r, indent=2))
    elif args.create:
        r = post(f"/courses/{args.course_id}/pages", {"title": args.title, "body": args.body or ""})
        print(json.dumps(r, indent=2))
    else:
        items = paginate(f"/courses/{args.course_id}/pages")
        print(json.dumps(items, indent=2))

def cmd_calendar(args):
    items = paginate("/calendar_events", {"context_codes[]": args.context, "start_date": args.start_date, "end_date": args.end_date})
    print(json.dumps(items, indent=2))

def cmd_users(args):
    r = get(f"/users/{args.user_id}", {"include": args.include})
    print(json.dumps(r, indent=2))

def cmd_gradebook(args):
    r = get(f"/courses/{args.course_id}/gradebook")
    print(json.dumps(r, indent=2))

def cmd_outcomes(args):
    r = paginate(f"/courses/{args.course_id}/outcomes")
    print(json.dumps(r, indent=2))

def cmd_progress(args):
    r = get(f"/progress/{args.progress_id}")
    print(json.dumps(r, indent=2))

# ── Main CLI ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Canvas LMS CLI")
    sub = parser.add_subparsers()

    # Courses
    p = sub.add_parser("courses", help="List/get courses")
    p.add_argument("--course-id", type=int, help="Course ID")
    p.add_argument("--include", action="append", help="Includes (e.g. total_scores)")
    p.set_defaults(func=cmd_courses)

    # Enrollments
    p = sub.add_parser("enrollments", help="List enrollments")
    p.add_argument("course_id", type=int)
    p.add_argument("--type")
    p.add_argument("--state")
    p.set_defaults(func=cmd_enrollments)

    # Assignments
    p = sub.add_parser("assignments", help="List/create assignments")
    p.add_argument("course_id", type=int)
    p.add_argument("--assignment-id", type=int)
    p.add_argument("--create", action="store_true")
    p.add_argument("--name")
    p.add_argument("--description")
    p.add_argument("--points", type=float)
    p.add_argument("--due-at")
    p.set_defaults(func=cmd_assignments)

    # Submissions
    p = sub.add_parser("submissions", help="Get submissions")
    p.add_argument("course_id", type=int)
    p.add_argument("--student-id", type=int)
    p.add_argument("--assignment-id", type=int)
    p.add_argument("--assignment-ids", action="append")
    p.add_argument("--graded", type=lambda x: x == "true", default=None)
    p.set_defaults(func=cmd_submissions)

    # Grades
    p = sub.add_parser("grades", help="Get user grades")
    p.add_argument("course_id", type=int)
    p.add_argument("user_id", type=int)
    p.set_defaults(func=cmd_grades)

    # Announcements
    p = sub.add_parser("announcements", help="List/create announcements")
    p.add_argument("course_id", type=int)
    p.add_argument("--announcement-id", type=int)
    p.add_argument("--create", action="store_true")
    p.add_argument("--title")
    p.add_argument("--message")
    p.set_defaults(func=cmd_announcements)

    # Modules
    p = sub.add_parser("modules", help="List/create modules")
    p.add_argument("course_id", type=int)
    p.add_argument("--module-id", type=int)
    p.add_argument("--create", action="store_true")
    p.add_argument("--name")
    p.add_argument("--position", type=int)
    p.add_argument("--add-item", action="store_true")
    p.add_argument("--title")
    p.add_argument("--item-type")
    p.add_argument("--content-id")
    p.set_defaults(func=cmd_modules)

    # Discussions
    p = sub.add_parser("discussions", help="List/create discussion topics")
    p.add_argument("course_id", type=int)
    p.add_argument("--topic-id", type=int)
    p.add_argument("--create", action="store_true")
    p.add_argument("--title")
    p.add_argument("--message")
    p.set_defaults(func=cmd_discussions)

    # Files
    p = sub.add_parser("files", help="List files")
    p.add_argument("course_id", type=int)
    p.add_argument("--file-id", type=int)
    p.set_defaults(func=cmd_files)

    # Quizzes
    p = sub.add_parser("quizzes", help="List/create quizzes")
    p.add_argument("course_id", type=int)
    p.add_argument("--quiz-id", type=int)
    p.add_argument("--create", action="store_true")
    p.add_argument("--title")
    p.add_argument("--description")
    p.set_defaults(func=cmd_quizzes)

    # Pages
    p = sub.add_parser("pages", help="List/create wiki pages")
    p.add_argument("course_id", type=int)
    p.add_argument("--url")
    p.add_argument("--create", action="store_true")
    p.add_argument("--title")
    p.add_argument("--body")
    p.set_defaults(func=cmd_pages)

    # Calendar
    p = sub.add_parser("calendar", help="List calendar events")
    p.add_argument("--context", action="append")
    p.add_argument("--start-date")
    p.add_argument("--end-date")
    p.set_defaults(func=cmd_calendar)

    # Users
    p = sub.add_parser("users", help="Get user info")
    p.add_argument("user_id", type=int)
    p.add_argument("--include", action="append")
    p.set_defaults(func=cmd_users)

    # Gradebook
    p = sub.add_parser("gradebook", help="Get gradebook")
    p.add_argument("course_id", type=int)
    p.set_defaults(func=cmd_gradebook)

    # Outcomes
    p = sub.add_parser("outcomes", help="List course outcomes")
    p.add_argument("course_id", type=int)
    p.set_defaults(func=cmd_outcomes)

    # Progress
    p = sub.add_parser("progress", help="Get progress")
    p.add_argument("progress_id", type=int)
    p.set_defaults(func=cmd_progress)

    args = parser.parse_args()
    if hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
