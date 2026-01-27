---
name: meeting-list
description: Shows you all the people you've met with recently, organized by meeting
metadata:
  author: Zo
  category: Official
  display-name: Find meetings with attendees
---

Retrieves Google Calendar events for a specified date range, and applying filters. Returns list of meetings with attendee list.

# Inputs

- Date range: default to last 1 week if not specified
- Filter criteria: default to small groups (&lt; 3) if not specified

# Protocol

1. **Fetch calendar events** using the google calendar tool:
   - Set `singleEvents: true` to expand recurring events
   - Set `orderBy: startTime` for chronological ordering
   - Set `maxResults: 250` to capture all events

2. **Parse the API response directly**:
   - Extract the `attendees` array from each event in the response
   - Count attendees excluding your own email (ben@substrate.run)
   - Filter events where attendee count &lt; 3
   - Extract the event `start.dateTime` and `summary` fields
   - IMPORTANT: Do NOT write a script or run a bash command. Simply look at the response and filter it DIRECTLY in your output response. DO NOT call another tool, simply output the result

3. **Organize results** into output:
   - Group filtered events by date
   - Sort chronologically
   - Format attendee list by extracting `email` fields from attendee objects

# Output

A table with these columns (time doesn't matter)

- **Date** (MM-DD)
- **Meeting title**
- **Attendee list** (emails, excluding your own)

