---
name: Find recent Craigslist missed connections
description: Finds recent missed connections posts from Craigslist and gives you the highlights
metadata:
  author: Zo
  emoji: 💕
---

# Protocol

### Step 1: Fetch the missed connections page

```markdown
read_webpage https://newyork.craigslist.org/search/mis
```

This saves the HTML to the conversation workspace.

### Step 2: Extract recent post URLs by ID pattern

Craigslist uses sequential post IDs. Recent posts have higher IDs:

- `7885xxxxxx` = most recent day
- `7884xxxxxx` = 1-2 days ago
- `7883xxxxxx` = 2-3 days ago

```bash
# Extract URLs matching recent post IDs (last 3 days)
grep -o 'https://newyork.craigslist.org/[^"]*' /path/to/saved.html | grep -E '788[345]' | head -20
```

### Step 3: Read individual posts in parallel

Use multiple `read_webpage` calls concurrently to fetch 5-10 interesting posts at once. This is much faster than sequential calls.

- IMPORTANT: use `tool read_webpage` , do not do alternatives like parallel curl bash commands + manual parsing.

# Response

Extract the key details from each post and list each in a concise bullet. Be cheeky.

- &lt;brief story summary&gt;, &lt;location&gt;

