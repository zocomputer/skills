#!/usr/bin/env python3
"""
Google Calendar CLI
Query events and find free time blocks.

Usage:
    python calendar.py events [DATE]           # List events (default: today)
    python calendar.py events 2026-01-25
    python calendar.py events tomorrow
    python calendar.py events "next monday"
    
    python calendar.py free [DATE]             # Find free time blocks
    python calendar.py free today --start 9 --end 18
    python calendar.py free 2026-01-25 --min-duration 30
    
    python calendar.py week                    # Show this week's events
"""

import sys
sys.path.insert(0, "/home/.z/google-oauth")

import argparse
import json
from datetime import datetime, timedelta, time as dt_time
from zoneinfo import ZoneInfo
from google_auth import get_calendar_service

DEFAULT_TZ = ZoneInfo("America/New_York")

def parse_date(date_str: str) -> datetime:
    """Parse flexible date input."""
    date_str = date_str.lower().strip()
    today = datetime.now(DEFAULT_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    
    if date_str in ("today", ""):
        return today
    elif date_str == "tomorrow":
        return today + timedelta(days=1)
    elif date_str == "yesterday":
        return today - timedelta(days=1)
    elif date_str.startswith("next "):
        day_name = date_str[5:]
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        if day_name in days:
            target = days.index(day_name)
            current = today.weekday()
            delta = (target - current) % 7
            if delta == 0:
                delta = 7
            return today + timedelta(days=delta)
    
    # Try parsing as YYYY-MM-DD
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=DEFAULT_TZ)
    except ValueError:
        pass
    
    # Try parsing as MM-DD
    try:
        parsed = datetime.strptime(date_str, "%m-%d")
        return parsed.replace(year=today.year, tzinfo=DEFAULT_TZ)
    except ValueError:
        pass
    
    raise ValueError(f"Could not parse date: {date_str}")

def get_events(date: datetime, calendar_id: str = "primary") -> list:
    """Fetch events for a specific day."""
    service = get_calendar_service()
    
    start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    
    events = service.events().list(
        calendarId=calendar_id,
        timeMin=start.isoformat(),
        timeMax=end.isoformat(),
        singleEvents=True,
        orderBy="startTime"
    ).execute()
    
    return events.get("items", [])

def get_week_events(calendar_id: str = "primary") -> list:
    """Fetch events for the current week."""
    service = get_calendar_service()
    
    today = datetime.now(DEFAULT_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=7)
    
    events = service.events().list(
        calendarId=calendar_id,
        timeMin=start_of_week.isoformat(),
        timeMax=end_of_week.isoformat(),
        singleEvents=True,
        orderBy="startTime"
    ).execute()
    
    return events.get("items", [])

def parse_event_time(event: dict, key: str) -> datetime | None:
    """Extract datetime from event start/end."""
    time_info = event.get(key, {})
    
    if "dateTime" in time_info:
        dt_str = time_info["dateTime"]
        # Handle timezone offset
        return datetime.fromisoformat(dt_str).astimezone(DEFAULT_TZ)
    elif "date" in time_info:
        # All-day event
        return None
    
    return None

def find_free_blocks(
    date: datetime,
    day_start_hour: int = 9,
    day_end_hour: int = 18,
    min_duration_minutes: int = 15,
    calendar_id: str = "primary"
) -> list:
    """Find free time blocks on a given day."""
    events = get_events(date, calendar_id)
    
    day_start = date.replace(hour=day_start_hour, minute=0, second=0, microsecond=0)
    day_end = date.replace(hour=day_end_hour, minute=0, second=0, microsecond=0)
    
    # Collect busy periods
    busy = []
    for event in events:
        start = parse_event_time(event, "start")
        end = parse_event_time(event, "end")
        
        if start is None:  # All-day event - whole day is busy
            return []
        
        # Clamp to work hours
        start = max(start, day_start)
        end = min(end, day_end)
        
        if start < end:
            busy.append((start, end))
    
    # Sort by start time
    busy.sort(key=lambda x: x[0])
    
    # Merge overlapping periods
    merged = []
    for start, end in busy:
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], end))
        else:
            merged.append((start, end))
    
    # Find gaps
    free = []
    cursor = day_start
    
    for busy_start, busy_end in merged:
        if cursor < busy_start:
            gap_minutes = (busy_start - cursor).seconds // 60
            if gap_minutes >= min_duration_minutes:
                free.append((cursor, busy_start))
        cursor = max(cursor, busy_end)
    
    # Check end of day
    if cursor < day_end:
        gap_minutes = (day_end - cursor).seconds // 60
        if gap_minutes >= min_duration_minutes:
            free.append((cursor, day_end))
    
    return free

def format_time(dt: datetime) -> str:
    """Format datetime for display."""
    return dt.strftime("%-I:%M%p").lower()

def format_duration(start: datetime, end: datetime) -> str:
    """Format duration in hours/minutes."""
    minutes = int((end - start).total_seconds() // 60)
    if minutes >= 60:
        hours = minutes // 60
        mins = minutes % 60
        if mins:
            return f"{hours}h {mins}m"
        return f"{hours}h"
    return f"{minutes}m"

def cmd_events(args):
    """List events for a day."""
    date = parse_date(args.date or "today")
    events = get_events(date)
    
    print(f"📅 {date.strftime('%A, %B %-d, %Y')}\n")
    
    if not events:
        print("  No events scheduled.")
        return
    
    for event in events:
        summary = event.get("summary", "(No title)")
        start = parse_event_time(event, "start")
        end = parse_event_time(event, "end")
        
        if start:
            time_str = f"{format_time(start)} - {format_time(end)}"
            duration = format_duration(start, end)
            print(f"  • {time_str} ({duration}): {summary}")
        else:
            print(f"  • All day: {summary}")

def cmd_free(args):
    """Find free time blocks."""
    date = parse_date(args.date or "today")
    free_blocks = find_free_blocks(
        date,
        day_start_hour=args.start,
        day_end_hour=args.end,
        min_duration_minutes=args.min_duration
    )
    
    print(f"🕐 Free time on {date.strftime('%A, %B %-d, %Y')}")
    print(f"   (Working hours: {args.start}:00 - {args.end}:00, min block: {args.min_duration}m)\n")
    
    if not free_blocks:
        print("  No free blocks found.")
        return
    
    total_free = 0
    for start, end in free_blocks:
        duration = format_duration(start, end)
        minutes = int((end - start).total_seconds() // 60)
        total_free += minutes
        print(f"  ✓ {format_time(start)} - {format_time(end)} ({duration})")
    
    print(f"\n  Total free: {format_duration(date, date + timedelta(minutes=total_free))}")

def cmd_week(args):
    """Show week overview."""
    events = get_week_events()
    
    today = datetime.now(DEFAULT_TZ).replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_week = today - timedelta(days=today.weekday())
    
    print(f"📅 Week of {start_of_week.strftime('%B %-d, %Y')}\n")
    
    # Group by day
    by_day = {}
    for event in events:
        start = parse_event_time(event, "start")
        if start:
            day = start.date()
        else:
            day = datetime.fromisoformat(event["start"]["date"]).date()
        
        if day not in by_day:
            by_day[day] = []
        by_day[day].append(event)
    
    for i in range(7):
        day = (start_of_week + timedelta(days=i)).date()
        day_name = day.strftime("%A %-m/%-d")
        is_today = day == today.date()
        marker = " ← today" if is_today else ""
        
        print(f"  {day_name}{marker}")
        
        if day in by_day:
            for event in by_day[day]:
                summary = event.get("summary", "(No title)")
                start = parse_event_time(event, "start")
                if start:
                    print(f"    • {format_time(start)}: {summary}")
                else:
                    print(f"    • All day: {summary}")
        else:
            print("    (free)")
        print()

def cmd_json(args):
    """Output events as JSON for programmatic use."""
    date = parse_date(args.date or "today")
    events = get_events(date)
    
    output = []
    for event in events:
        output.append({
            "id": event.get("id"),
            "summary": event.get("summary"),
            "start": event.get("start"),
            "end": event.get("end"),
            "location": event.get("location"),
            "description": event.get("description"),
        })
    
    print(json.dumps(output, indent=2))

def main():
    parser = argparse.ArgumentParser(description="Google Calendar CLI")
    subparsers = parser.add_subparsers(dest="command", help="Command")
    
    # events command
    events_parser = subparsers.add_parser("events", help="List events for a day")
    events_parser.add_argument("date", nargs="?", default="today", help="Date (today, tomorrow, YYYY-MM-DD, etc.)")
    events_parser.set_defaults(func=cmd_events)
    
    # free command
    free_parser = subparsers.add_parser("free", help="Find free time blocks")
    free_parser.add_argument("date", nargs="?", default="today", help="Date to check")
    free_parser.add_argument("--start", type=int, default=9, help="Day start hour (default: 9)")
    free_parser.add_argument("--end", type=int, default=18, help="Day end hour (default: 18)")
    free_parser.add_argument("--min-duration", type=int, default=15, help="Minimum block duration in minutes (default: 15)")
    free_parser.set_defaults(func=cmd_free)
    
    # week command
    week_parser = subparsers.add_parser("week", help="Show week overview")
    week_parser.set_defaults(func=cmd_week)
    
    # json command
    json_parser = subparsers.add_parser("json", help="Output events as JSON")
    json_parser.add_argument("date", nargs="?", default="today", help="Date")
    json_parser.set_defaults(func=cmd_json)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    args.func(args)

if __name__ == "__main__":
    main()
