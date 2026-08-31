---
name: canvas-lms
description: Fetch, create, and manage Canvas LMS data including courses, assignments, grades, enrollments, announcements, modules, discussions, quizzes, pages, files, and calendar events. Use when asked about Canvas LMS, school assignments, grades, course content, homework, announcements, or any Canvas-related school data.
metadata:
  author: shadowsdistant.zo.computer
---
# Canvas LMS Skill

## Setup

Two secrets must be set in [Zo Secrets](/?t=settings&s=advanced) before use:

- `CANVAS_API_KEY` — your Canvas API access token
- `CANVAS_URL` — your Canvas instance base URL (e.g. `https://school.instructure.com`)

To get an API key: log into Canvas → Account → Settings → + New Access Token.

## Architecture

- **CLI script**: `Skills/canvas-lms/scripts/canvas_cli.py` — handles all API calls, pagination, and error handling
- **API reference**: `Skills/canvas-lms/references/api_endpoints.md` — complete endpoint documentation

## Usage Pattern

Run the CLI script with `run_bash_command`. The script reads `CANVAS_API_KEY` and `CANVAS_URL` from environment variables automatically (from Zo Secrets).

```bash
python3 Skills/canvas-lms/scripts/canvas_cli.py <command> [args]
```

## Commands

### Courses
```bash
# List all courses
python3 Skills/canvas-lms/scripts/canvas_cli.py courses

# Get specific course
python3 Skills/canvas-lms/scripts/canvas_cli.py courses --course-id 12345 --include total_scores
```

### Enrollments
```bash
# List enrollments for a course
python3 Skills/canvas-lms/scripts/canvas_cli.py enrollments 12345

# Filter by type/state
python3 Skills/canvas-lms/scripts/canvas_cli.py enrollments 12345 --type Student --state active
```

### Assignments
```bash
# List all assignments
python3 Skills/canvas-lms/scripts/canvas_cli.py assignments 12345

# Get specific assignment
python3 Skills/canvas-lms/scripts/canvas_cli.py assignments 12345 --assignment-id 99

# Create assignment
python3 Skills/canvas-lms/scripts/canvas_cli.py assignments 12345 --create \
  --name "Chapter 5 Quiz" --points 50 --due-at "2026-03-30T23:59:00Z"
```

### Submissions
```bash
# Get all submissions for a course
python3 Skills/canvas-lms/scripts/canvas_cli.py submissions 12345

# Get submissions for a specific student
python3 Skills/canvas-lms/scripts/canvas_cli.py submissions 12345 --student-id 456

# Get specific assignment submission
python3 Skills/canvas-lms/scripts/canvas_cli.py submissions 12345 --student-id 456 --assignment-id 99
```

### Grades
```bash
# Get a user's grades in a course
python3 Skills/canvas-lms/scripts/canvas_cli.py grades 12345 456

# Get gradebook
python3 Skills/canvas-lms/scripts/canvas_cli.py gradebook 12345
```

### Announcements
```bash
# List announcements
python3 Skills/canvas-lms/scripts/canvas_cli.py announcements 12345

# Create announcement
python3 Skills/canvas-lms/scripts/canvas_cli.py announcements 12345 --create \
  --title "Midterm Schedule" --message "The midterm will be on..."
```

### Modules
```bash
# List modules
python3 Skills/canvas-lms/scripts/canvas_cli.py modules 12345

# Create module
python3 Skills/canvas-lms/scripts/canvas_cli.py modules 12345 --create --name "Unit 3"

# Add item to module
python3 Skills/canvas-lms/scripts/canvas_cli.py modules 12345 --module-id 5 --add-item \
  --title "Lecture Notes" --item-type SubHeader
```

### Discussions
```bash
# List discussion topics
python3 Skills/canvas-lms/scripts/canvas_cli.py discussions 12345

# Create discussion
python3 Skills/canvas-lms/scripts/canvas_cli.py discussions 12345 --create \
  --title "Week 5 Discussion" --message "Discuss the reading..."
```

### Files
```bash
# List course files
python3 Skills/canvas-lms/scripts/canvas_cli.py files 12345

# Get specific file info
python3 Skills/canvas-lms/scripts/canvas_cli.py files 12345 --file-id 77
```

### Quizzes
```bash
# List quizzes
python3 Skills/canvas-lms/scripts/canvas_cli.py quizzes 12345

# Create quiz
python3 Skills/canvas-lms/scripts/canvas_cli.py quizzes 12345 --create \
  --title "Chapter 5 Quiz" --description "10 multiple choice questions"
```

### Pages
```bash
# List wiki pages
python3 Skills/canvas-lms/scripts/canvas_cli.py pages 12345

# Get specific page
python3 Skills/canvas-lms/scripts/canvas_cli.py pages 12345 --url "lecture-notes"

# Create page
python3 Skills/canvas-lms/scripts/canvas_cli.py pages 12345 --create \
  --title "Lecture Notes" --body "<h1>Notes</h1><p>Content here</p>"
```

### Calendar Events
```bash
# List calendar events
python3 Skills/canvas-lms/scripts/canvas_cli.py calendar \
  --context course_12345 --start-date 2026-03-01 --end-date 2026-03-31
```

### Users
```bash
# Get user info
python3 Skills/canvas-lms/scripts/canvas_cli.py users 456 --include avatar

# List user enrollments
python3 Skills/canvas-lms/scripts/canvas_cli.py users 456
```

### Outcomes
```bash
# List course outcomes
python3 Skills/canvas-lms/scripts/canvas_cli.py outcomes 12345
```

### Progress
```bash
# Check progress of an async operation
python3 Skills/canvas-lms/scripts/canvas_cli.py progress 999
```

## Error Handling

- **401 Unauthorized**: The API key is invalid or expired. Generate a new one in Canvas.
- **403 Forbidden**: The token lacks permission for that action (e.g., student trying to create assignments).
- **404 Not Found**: The resource ID doesn't exist or you don't have access.
- **Rate limited**: The script includes automatic pagination but respects rate limits.

## Notes

- All list endpoints automatically paginate (fetches all pages).
- Timestamps use ISO 8601 format (`2026-03-30T23:59:00Z`).
- Output is always formatted JSON for easy parsing.
- The API key and URL are read from environment variables set via Zo Secrets — never hardcoded.
