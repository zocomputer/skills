---
name: qor-help
description: Quick reference summarizing the purpose and usage of all QoreLogic commands.
metadata:
  author: mythologIQ
  category: Community
  display-name: QoreLogic Help
  emoji: "\u2753"
---

# /qor-help - Command Summary

## Purpose

Quick reference for all QoreLogic commands. No file reads required - pure reference output.

**Note**: This skill is reference-only and does not activate a persona. It provides navigation guidance for the S.H.I.E.L.D. lifecycle.

## Command Summary

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/qor-bootstrap` | Initialize QoreLogic DNA for a **new workspace** | First-time setup only |
| `/qor-plan` | Create implementation plan for a **new feature** | Planning features in existing workspace |
| `/qor-status` | Diagnose lifecycle stage and next action | Any time you need current state |
| `/qor-audit` | Judge review for L2/L3 risk work (PASS/VETO) | Before high-risk changes |
| `/qor-implement` | Execute work under KISS constraints | After `/qor-audit` PASS |
| `/qor-refactor` | Apply scoped refactors with guardrails | After implementation or when requested |
| `/qor-validate` | Verify Merkle chain integrity | Before delivery or handoff |
| `/qor-substantiate` | Seal the session and record evidence | End of completed work session |
| `/qor-debug` | Two-phase diagnostic for code issues | Runtime errors, test failures |
| `/qor-document` | Author documentation with review gate | Before release or handoff |
| `/qor-course-correct` | Recover from process-level drift | When direction has gone wrong |
| `/qor-organize` | Adaptive workspace organization | Structure cleanup |
| `/qor-research` | Deep research on external codebases | Before integration work |
| `/qor-repo-audit` | Repository health check | Periodic maintenance |
| `/qor-repo-release` | Release management | Publishing versions |
| `/qor-repo-scaffold` | Repository foundation setup | New repo initialization |

## Quick Decision Tree

```
New workspace?         → /qor-bootstrap
New feature?           → /qor-plan
Check state?           → /qor-status
Ready to build?        → /qor-audit → /qor-implement
Fix code issue?        → /qor-debug
Process stuck?         → /qor-course-correct
Done with session?     → /qor-substantiate
```

## S.H.I.E.L.D. Lifecycle Phases

| Phase | Primary Skill | Supporting Skills |
|-------|---------------|-------------------|
| **S** - Secure Intent | `/qor-bootstrap` | `/qor-repo-scaffold`, `/qor-repo-audit`, `/qor-organize` |
| **H** - Hypothesize | `/qor-plan` | `/qor-research`, `/qor-status` |
| **I** - Interrogate | `/qor-audit` | `/qor-validate`, `/qor-course-correct` |
| **E** - Execute | `/qor-implement` | `/qor-debug` (MANDATORY after), `/qor-refactor` |
| **L** - Lock Proof | `/qor-substantiate` | `/qor-document`, `/qor-validate` |
| **D** - Deliver | `/qor-repo-release` | `/qor-document` |

### Phase Details

```
S - Secure Intent    → Seed project DNA, initialize Merkle chain
H - Hypothesize      → Create blueprints with risk grades and Section 4 limits
I - Interrogate      → Adversarial tribunal: PASS or VETO
E - Execute          → Build under KISS constraints, then /qor-debug
L - Lock Proof       → Verify Reality=Promise, cryptographic seal
D - Deliver          → Deploy with traceability, monitor for drift
```

**MANDATORY**: Run `/qor-debug` after every `/qor-implement` cycle.

## Skill Relationships

```
/qor-bootstrap ──→ /qor-plan ──→ /qor-audit (L2/L3) ──→ /qor-implement
       │                                                      │
       │                                                      ↓
       │                                               /qor-debug (MANDATORY)
       │                                                      │
       └──────────────────────────────────────────────────────┘
                                                              │
                                                              ↓
                                                     /qor-substantiate
                                                              │
                                                              ↓
                                                     /qor-repo-release
```

## Constraints

- **NEVER** execute other skills from within qor-help
- **ALWAYS** recommend `/qor-status` when user is uncertain

## Success Criteria

- [ ] Command summary displayed
- [ ] User directed to appropriate next skill

## Related Skills

- `/qor-status` - Check current lifecycle state (recommended starting point)
- `/qor-bootstrap` - Initialize new workspace
- `/qor-plan` - Plan new features

---

**Uncertain where to start?** Run `/qor-status` to see your current lifecycle state.
