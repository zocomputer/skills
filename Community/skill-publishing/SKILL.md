---
name: skill-publishing
description: Package and publish skills to the Zo Skills Hub. Use when the user asks to "publish this skill", "create a PR for this skill", or "package and submit to skills hub".
category: Development
metadata:
  author: YOUR_HANDLE.zo.computer
  emojis: ["📦", "🚀", "📝"]
tags:
  - skills
  - publishing
  - github
  - pr
---

# Skill Publishing

Package and publish your custom skills to the Zo Skills Hub for others to use.

## When to Use

Use this skill when:
- User says "publish this skill" or "submit to skills hub"
- User wants to share a skill they created
- User mentions "package this skill" or "create a PR for my skill"
- User asks how to contribute a skill to the community

## Prerequisites

1. **GitHub CLI (gh)** must be authenticated
2. **bun** must be available (pre-installed on Zo)
3. The skill must be in `/home/workspace/Skills/<skill-name>/` with a valid `SKILL.md`

## ⚠️ Sanitization (REQUIRED)

**CRITICAL: Always sanitize skills before publishing.** Skills must NOT contain any personally identifiable information (PII), secrets, or user-specific data.

### What Must Be Sanitized

| Data Type | Example | Replace With |
|-----------|---------|--------------|
| Email addresses | `user@gmail.com` | `your-email@example.com` or remove |
| User handles | `curtastrophe.zo.computer` | `YOUR_HANDLE.zo.computer` |
| API keys / tokens | `sk_live_abc123...` | `YOUR_API_KEY` or remove |
| Passwords / secrets | `mySecretPass123` | `YOUR_SECRET` or remove |
| Specific file paths | `/Users/curtis/Documents/` | `/home/workspace/` or generic path |
| Phone numbers | `+1-780-555-1234` | Remove or `+1-555-555-5555` |
| Real names | `John Smith` | Remove or generic placeholder |
| Company names (if private) | `Acme Corp` | Remove or `Your Company` |
| Internal URLs | `https://internal.company.com` | Remove or generic |
| Database names | `my_prod_database` | `your_database` |
| IP addresses | `192.168.1.100` | `192.168.1.1` or remove |

### Sanitization Process

**Step 1: Scan for PII patterns**

```bash
# Check for email addresses
grep -rE '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}' /home/workspace/Skills/<skill-name>/

# Check for API keys (common patterns)
grep -rE '(sk_live|sk_test|api_key|apikey|token|secret|password)\s*[=:]\s*["\']?[^\s"\'\"]+' /home/workspace/Skills/<skill-name>/

# Check for phone numbers
grep -rE '\+?[0-9]{1,3}[-. ]?\(?[0-9]{3}\)?[-. ]?[0-9]{3}[-. ]?[0-9]{4}' /home/workspace/Skills/<skill-name>/

# Check for your handle
grep -r 'curtastrophe\|<your-handle>' /home/workspace/Skills/<skill-name>/
```

**Step 2: Replace with placeholders**

Use generic placeholders that clearly indicate where the user should substitute their own values:

```yaml
# Good examples:
author: YOUR_HANDLE.zo.computer
api_key: YOUR_API_KEY_HERE
email: your-email@example.com
```

**Step 3: Verify frontmatter**

Ensure `metadata.author` uses a placeholder, NOT your actual handle:

```yaml
# WRONG:
metadata:
  author: curtastrophe.zo.computer

# CORRECT:
metadata:
  author: YOUR_HANDLE.zo.computer
```

### Pre-Publish Sanitization Checklist

Before copying the skill to skills-hub, verify:

- [ ] **No email addresses** (yours or others')
- [ ] **No API keys, tokens, or secrets** (even example ones)
- [ ] **No personal handles** in author field or code examples
- [ ] **No specific file paths** containing your username
- [ ] **No phone numbers**
- [ ] **No real names** of individuals
- [ ] **No internal/private URLs**
- [ ] **No database names** that identify specific installations
- [ ] **No IP addresses** (or use `192.168.x.x` ranges)
- [ ] **All placeholders are obvious** (use `YOUR_*` prefix)

### Files to Check

Sanitize ALL files in the skill directory:
- `SKILL.md` - Main skill file
- `scripts/*.ts` or `scripts/*.py` - Any scripts
- `references/*.md` - Documentation files
- `assets/*` - Check for embedded text in images/docs

## Publishing Workflow

### Step 1: Validate the Skill

Before publishing, ensure the skill follows the Agent Skills spec:

```bash
# Check skill structure
ls -la /home/workspace/Skills/<skill-name>/

# Verify SKILL.md frontmatter has required fields:
# - name (lowercase, hyphens only, matches directory name)
# - description (1-1024 chars)
# - metadata.author
```

Required frontmatter fields:
```yaml
---
name: my-skill
description: Brief description of what the skill does
metadata:
  author: your-handle.zo.computer
---
```

Optional but recommended:
- `category` - One of: Development, Productivity & Planning, Writing & Content, Data & Integrations, Media & Graphics, Communication, Research & Learning, System & Admin, External, Community
- `metadata.emojis` - Array of 0-3 emojis
- `tags` - Array of searchable keywords
- `compatibility` - Environment requirements

### Step 2: Clone the Skills Hub

```bash
cd /home/workspace
git clone --depth=1 https://github.com/zocomputer/skills.git skills-hub
```

### Step 3: Copy Skill to Community Folder

```bash
cp -r /home/workspace/Skills/<skill-name> /home/workspace/skills-hub/Community/
```

### Step 4: Run Validation

```bash
cd /home/workspace/skills-hub
bun validate
```

If validation fails, fix the issues reported.

### Step 5: Create a Branch and Commit

```bash
cd /home/workspace/skills-hub
git checkout -b add-<skill-name>-skill
git add Community/<skill-name>/
git commit -m "Add <skill-name> skill"
```

### Step 6: Push and Create PR

```bash
# Push to your fork
gh repo fork zocomputer/skills --clone=false --remote=true 2>/dev/null || true
git push -u origin HEAD

# Create PR
gh pr create --repo zocomputer/skills \
  --title "Add <skill-name> skill" \
  --body "$(cat <<'EOF'
## Description

Brief description of what this skill does and when to use it.

## Features

- Feature 1
- Feature 2

## Testing

Describe how you tested the skill.

## Checklist

- [ ] SKILL.md has required frontmatter (name, description, metadata.author)
- [ ] Skill directory name matches `name` in frontmatter
- [ ] Description clearly explains when to use the skill
- [ ] No sensitive data (API keys, tokens) included
- [ ] `bun validate` passes
EOF
)"
```

## Skill Structure Requirements

### Directory Structure

```
skill-name/
├── SKILL.md          # Required: Main skill file with frontmatter
├── scripts/          # Optional: Executable scripts
├── references/       # Optional: Documentation and references
└── assets/           # Optional: Static resources
```

### SKILL.md Format

```markdown
---
name: skill-name
description: When to use this skill and what it does
category: Development
metadata:
  author: handle.zo.computer
  emojis: ["📦", "🚀"]
tags:
  - keyword1
  - keyword2
compatibility: Created for Zo Computer
---

# Skill Title

Brief introduction.

## When to Use

Describe scenarios when this skill should be activated.

## Instructions

Detailed instructions for using the skill.

## Examples

Examples of how to use the skill.
```

## Validation Rules

The `bun validate` command checks:

1. **Required directories**: Skill must be in Zo/, External/, Community/, or Connections/
2. **Allowed subdirectories**: Only `assets/`, `references/`, `scripts/`
3. **SKILL.md exists**: Every skill must have a SKILL.md file
4. **Frontmatter fields**:
   - `name` - Required, 1-64 chars, lowercase/numbers/hyphens only
   - `description` - Required, 1-1024 chars
   - `metadata.author` - Required
5. **Directory name matches `name`**: The skill folder must match the `name` field

## Quick Commands

```bash
# Validate all skills
cd /home/workspace/skills-hub && bun validate

# Generate manifest (done automatically on merge)
cd /home/workspace/skills-hub && bun manifest

# Sync external skills
cd /home/workspace/skills-hub && bun sync

# Check PR status
gh pr list --repo zocomputer/skills --author @me
```

## Common Issues

### "name field doesn't match directory name"
- Ensure the skill folder name matches the `name` in frontmatter exactly
- Use lowercase with hyphens (e.g., `my-skill` not `MySkill`)

### "Missing required field"
- Add `name`, `description`, and `metadata.author` to frontmatter

### "Invalid directory structure"
- Move files to allowed subdirectories: `scripts/`, `references/`, `assets/`
- Remove any other directories

## After PR Merge

Once your PR is merged:
1. The skill appears in the manifest.json automatically
2. Users can install it via: `Skills > Install > <skill-name>`
3. The skill appears in the Zo Skills Hub README

## Example: Full Publishing Session

```
User: "Package my analytics-tracking skill and publish to the Zo skills hub"

Zo should:
1. Sanitize the skill - scan for and remove all PII
2. Validate the skill at /home/workspace/Skills/analytics-tracking/SKILL.md
3. Clone or update the skills-hub repo
4. Copy the sanitized skill to Community/
5. Run bun validate
6. Create branch, commit, push
7. Create PR with descriptive title and body
8. Report PR URL to user
```

## Sanitization Quick Reference

When in doubt, use these replacements:

| If you see... | Replace with... |
|---------------|-----------------|
| Your actual handle | `YOUR_HANDLE.zo.computer` |
| Your actual email | `your-email@example.com` |
| Any API key/token | `YOUR_API_KEY` or remove entirely |
| Specific paths like `/Users/yourname/` | `/home/workspace/` |
| Company-specific URLs | Remove or use `https://api.example.com` |
| Real person names | Remove or use generic names |
