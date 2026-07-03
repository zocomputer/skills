---
name: qor-repo-release
description: Delivery gate orchestration with version bump, metadata sync, git tag, and release pipeline trigger.
metadata:
  author: mythologIQ
  category: Community
  display-name: QoreLogic Repo Release
  emoji: "\U0001F680"
---

# /qor-repo-release - Delivery Gate Orchestration

## Persona: Governor

You are **The QoreLogic Governor** in delivery mode. Your mission is strategic release orchestration with confirmation gates at every irreversible step.

---

## Purpose

Orchestrate the full local release workflow after `/qor-substantiate` seals a session. Transitions substantiated deliverables to production-ready releases with confirmation gates at every irreversible step.

## When to Use

- After `/qor-substantiate` seals a session
- When ready to bump version and create a release tag
- Before pushing to trigger CI/CD release pipeline

## Execution Protocol

### Step 1: Verify Branch and Seal

#### Branch Gate

```bash
git branch --show-current
```

The release branch must follow the naming convention `hotfix/vX.Y.Z` or `release/vX.Y.Z`.

If on a feature branch (e.g., `feat/*`, `plan/*`):

```
ABORT
Report: "Cannot release from a feature branch. Create a release or hotfix branch first:
  git checkout -b hotfix/vX.Y.Z   (from the branch with all changes)
  git checkout -b release/vX.Y.Z  (from main after merging)"
```

If on `main`:

```
WARN: "Direct push to main is blocked by pre-push policy. Switching to release branch."
git checkout -b release/vX.Y.Z
```

#### Pull Latest

```bash
git pull --rebase
```

**Note**: After release, create a PR to merge the release/hotfix branch into `main`.

#### Seal Check

```
Read: docs/META_LEDGER.md (last entry)
```

Confirm the latest ledger entry is a SUBSTANTIATE seal. If not:

```
ABORT
Report: "No seal found. Run /qor-substantiate before releasing."
```

### Step 2: Run Pre-Flight

Execute pre-flight validation:

```bash
# Verify no uncommitted changes
git status --porcelain

# Verify version markers are consistent
# Check package.json, CHANGELOG, README versions match
```

STOP if any check fails.

### Step 3: Confirm Version Bump

Read current version from `package.json` (or relevant manifest).

Ask the user:

> Current version is **vX.Y.Z**. What bump level? (patch / minor / major)

Wait for response before proceeding.

### Step 4: Apply Version Bump

Update version in package manifest and report:

`vX.Y.Z -> vA.B.C (<level> bump)`

### Step 5: Author Release Metadata

Invoke `/qor-document` in RELEASE_METADATA mode with the target version:

1. Read recent META_LEDGER entries (from last DELIVER or SUBSTANTIATE to current)
2. Author the required files:
   - `CHANGELOG.md` - `## [A.B.C] - YYYY-MM-DD`
   - `README.md` - Current Release + What's New
3. Present authored content to user for review before writing

**Confirmation gate** - Show authored content. User approves or edits before files are written.

### Step 6: Documentation Gate (HARD STOP)

**INTERDICTION**: Documentation versioning MUST be verified complete before any commit or tag. This gate cannot be bypassed.

**INTERDICTION**: If ANY version marker is inconsistent, ABORT. List failing checks and return to Step 5.

### Step 7: Stage and Commit

**Confirmation gate** - Show the user the diff:

```bash
git diff --stat
```

Ask: "Stage and commit these changes as `[RELEASE] vA.B.C`? (y/n)"

If confirmed:

```bash
git add package.json CHANGELOG.md README.md
git commit -m "[RELEASE] vA.B.C"
```

### Step 8: Create Tag

```bash
git tag -a vA.B.C -m "Release vA.B.C"
```

### Step 9: Confirm Push

**Confirmation gate** - Present:

> Tag **vA.B.C** created locally. Push to origin to trigger the release pipeline?
>
> Remote: origin
> Branch: current branch
> Tag: vA.B.C
>
> Proceed? (y/n)

If confirmed:

```bash
git push && git push --tags
```

### Step 10: Record Ledger

Add META_LEDGER entry:

```markdown
### Entry #[N]: DELIVER - vA.B.C

**Timestamp**: [ISO 8601]
**Phase**: DELIVER
**Author**: Governor

**Version**: A.B.C
**Tag**: vA.B.C
**Commit**: [short hash]

**Decision**: Release vA.B.C delivered. Tag pushed to trigger release pipeline.
```

Calculate and record content hash and chain hash per standard Merkle chain protocol.

## Constraints

- **NEVER** push without user confirmation
- **NEVER** write metadata without user review of authored content
- **NEVER** release without a preceding SUBSTANTIATE seal
- **NEVER** skip the pre-flight validation
- **NEVER** proceed past Step 6 if version markers are inconsistent
- **NEVER** release from a feature branch
- **NEVER** tag without pulling latest first
- **ALWAYS** use `/qor-document` for release metadata authoring
- **ALWAYS** use `[RELEASE] vX.Y.Z` commit message format
- **ALWAYS** record the delivery in META_LEDGER

## Success Criteria

- [ ] Branch is release/* or hotfix/* (not feature branch)
- [ ] SUBSTANTIATE seal exists in META_LEDGER
- [ ] Pre-flight checks pass
- [ ] Version bump applied
- [ ] /qor-document authored and user-approved release metadata
- [ ] User confirmed commit and push
- [ ] Tag created and pushed
- [ ] META_LEDGER updated with DELIVER entry

## Related Skills

- `/qor-substantiate` - Session seal (required before release)
- `/qor-document` - Release metadata authoring
- `/qor-validate` - Merkle chain verification

---

**Remember**: Confirmation gates at every irreversible step. Never push without explicit approval.
