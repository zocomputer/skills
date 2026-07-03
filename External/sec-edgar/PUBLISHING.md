# Zo SEC Intelligence — Publishing Guide

## Step 1: Create GitHub Repository

The repo is already prepared at `/home/workspace/zo-sec-intelligence/`.

### Option A: Create via GitHub CLI (Recommended)

```bash
# Log into GitHub (if not already)
gh auth login

# Create the repo and push
cd /home/workspace/zo-sec-intelligence
gh repo create clarion-systems/zo-sec-intelligence --public --source=. --push
```

### Option B: Create via GitHub Web UI

1. Go to https://github.com/new
2. Create repo: `clarion-systems/zo-sec-intelligence` (public)
3. Then push:

```bash
cd /home/workspace/zo-sec-intelligence
git remote add origin https://github.com/clarion-systems/zo-sec-intelligence.git
git push -u origin main
```

## Step 2: Publish to Zo Skills Registry

Once the GitHub repo is live, submit to the Zo Skills Registry:

### 2a. Fork the Skills Registry

1. Go to https://github.com/zocomputer/skills
2. Fork the repo to your account

### 2b. Add Your Skill to the Manifest

Edit `manifest.json` to add:

```json
{
  "tarball_url": "https://github.com/clarion-systems/zo-sec-intelligence/archive/refs/heads/main.tar.gz",
  "archive_root": "zo-sec-intelligence-main",
  "skills": {
    "sec-edgar": {
      "name": "SEC EDGAR Filing Intelligence",
      "description": "Natural-language SEC filing intelligence — fetch, index, search, and analyze SEC EDGAR filings for any public company via conversation. Built on the PageIndex vectorless RAG methodology.",
      "author": "cis.zo.computer",
      "source": "https://github.com/clarion-systems/zo-sec-intelligence",
      "category": "finance"
    }
  }
}
```

### 2c. Submit a Pull Request

1. Commit your changes
2. Push to your fork
3. Open a PR against `zocomputer/skills`

The Zo team will review and merge.

## Step 3: Users Can Install

Once in the registry, users can install with one line:

```
install the sec-edgar skill
```

Or from your GitHub repo directly:

```
install the sec-edgar skill from https://github.com/clarion-systems/zo-sec-intelligence
```

---

## Current Repo Structure

```
zo-sec-intelligence/
├── SKILL.md              # Skill definition (entry point for Zo)
├── README.md             # GitHub repo README
├── PRD.md                # Product requirements
├── ENGINEERING_PLAN.md   # Technical implementation details
├── STATUS.md             # Build progress and decisions log
├── AGENTS.md             # Agent-specific guidance
├── pyproject.toml        # Dependencies
├── .gitignore
├── scripts/
│   ├── __init__.py
│   ├── install.py        # First-time setup
│   ├── doctor.py         # Health check
│   ├── fetch.py          # EDGAR downloader
│   ├── index.py          # Indexing orchestrator
│   ├── search.py         # Search engine
│   ├── manifest.py       # Manifest utilities
│   ├── config.py         # Config read/write
│   ├── html2md.py        # HTML → Markdown converter
│   ├── tree_builder.py   # PageIndex tree builder
│   ├── llm.py            # /zo/ask wrapper
│   ├── rate_tracker.py   # SEC rate limiting
│   ├── utils.py          # Shared helpers
│   ├── tree_search.py    # Tree search utilities
│   └── check_indexed.py  # Check what's indexed
├── prompts/
│   └── weekly_fetch.md   # Automation instruction template
└── references/
    ├── filing_types.md   # SEC form types reference
    └── section_map.md    # Query-to-section mapping
```

---

## GitHub CLI Auth (if needed)

If `gh auth status` shows not logged in:

```bash
gh auth login
# Select: GitHub.com
# Select: HTTPS
# Select: Login with a web browser
# Enter the one-time code shown
```

Then proceed with repo creation.
