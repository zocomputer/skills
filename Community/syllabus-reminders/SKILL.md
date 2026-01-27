---
name: Create syllabus reminders
description: Reads your syllabus, finds all due dates, and sets up text reminders and calendar events so you never miss an assignment
metadata:
  author: hatsunemiku.zo.computer
  category: Community
  emoji: 🔖
---

# Prerequisites

- [ ] Uploaded syllabus

- [ ] User should have phone number added in settings

- [ ] User should have Google Calendar connected in settings

---

# Input

- File path of the syllabus

---

# Protocol

1. Use `tool read_file` to read the syllabus and parse it for due dates of assignments, essays, quizzes, exams, etc.
2. For each parsed date, use `tool create_scheduled_task` with `delivery_method: "sms"` to create a reminder, set for the morning ONE DAY BEFORE the due date. Make sure to include the class name for context.
3. For each parsed date, use `tool use_app_google_calendar` with `google_calendar-quick-add-event` to create a calendar event ON the due date. Make sure to include the class name for context

