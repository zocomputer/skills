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
1. Validate the skill at /home/workspace/Skills/analytics-tracking/SKILL.md
2. Clone or update the skills-hub repo
3. Copy the skill to Community/
4. Run bun validate
5. Create branch, commit, push
6. Create PR with descriptive title and body
7. Report PR URL to user
```
