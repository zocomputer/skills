---
name: Text summary of important emails
description: Finds your most important emails from the past 2 days and texts you a summary with suggested follow-ups
metadata:
  author: Zo
  category: Official
  emoji: 📧
---

# Prerequisites

- [ ] User should have their Gmail connected. Verify with `tool list_app_tools` with slug `gmail`.

- [ ] User should have their phone number added.

---

# Protocol

1. Use `tool use_app_gmail` tool with `gmail-find-email` as the action, with the following props

```python
{
  "q": "after:<DATE>",
  "maxResults": 100,
  "withTextPayload": true
}
```

where `<DATE>` is the date two days ago in format `YYYY-MM-DD`

2. Identify the 5 most important emails. Consider the user's bio when determining which are most important. Also consider if the user has not read or not replied to the email (determined by examining the labels).
3. Summarize and provide suggestions for follow-ups. Keep it concise.
4. Use `tool send_sms_to_user` to text the user your summary.
5. Ask the user if they would like to set this up as an agent task to run daily. If so, use `tool create_scheduled_task` with `delivery_method: "sms"` and with instruction

```markdown
Run `prompt Prompts/important-email-digest.prompt.md` but IGNORE step 4 and step 5.
```

