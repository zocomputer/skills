---
name: Summarize Hacker News front page
description: Picks the most interesting articles from Hacker News, reads them, and emails you a summary
metadata:
  author: Zo
  emoji: 🔶
---

# Protocol

1. Use this curl comand to fetch front page stories using the Hacker News Algolia API.

```bash
curl -L "https://hn.algolia.com/api/v1/search?tags=front_page" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for hit in data['hits']:
    print(f\"{hit.get('objectID')} | {hit.get('title')} | {hit.get('points')} pts | {hit.get('num_comments')} comments | {hit.get('url')}\")
"
```

2. Filter out the top 5 articles that you think would be of interest to me.
3. Use parallel calls to `tool read_webpage` to get the contents of each article.
4. Summarize all the articles.

# Output

Summarize all the articles in a bullet list. For each article:

- Include the article link, hacker news link, points, and comment count.
- Summarize the article content.

Do not use citations, that would be redundant since links are included already.

Use `tool send_email_to_user` to send me the summary, with an appropriate title that includes today's date and time.

