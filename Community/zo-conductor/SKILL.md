---
name: zo-conductor
description: Use for complex, risky, multi-file, parallel, or delegated work in Zo Computer. Build a bounded task graph, route work by capability, isolate implementation in Git worktrees, require evidence-based verification, and obtain explicit acceptance before integration. Use whenever a task involves multiple agents, autonomous coding, repository changes, deployment, external messages, destructive operations, or a request to orchestrate work.
compatibility: Created for Zo Computer
metadata:
  author: jaknyfe.zo.computer
---
# Zo Conductor

Use this skill as the control layer for substantial work. The main Zo session remains the owner of scope, safety, integration, and the final user report.

## Operating rules

1. Read `/home/workspace/AGENTS.md`, the project `AGENTS.md`, `README.md`, and `DESIGN.md` when present.
2. Search memory before resuming prior work. Use Graphify for repository structure and relationships when available.
3. State the objective, success criteria, protected scope, risks, and approval boundaries.
4. Produce a task graph before dispatch. Every node needs an id, purpose, dependencies, ownership, expected output, verification, and stop condition.
5. Route by capability, not by a static model assumption. Use only agents that are actually callable in the current Zo session.
6. Keep implementation workers bounded. Prefer isolated Git worktrees for code changes; workers must not modify unrelated repositories or shared branches.
7. Never place credentials, tokens, cookies, private keys, or secret values in prompts, packets, logs, or task files.
8. Do not publish, deploy, send messages, spend money, or perform destructive operations without the normal user approval for that action.
9. Require evidence. For frontend or hosted changes, a successful build or HTTP response is insufficient; capture and inspect a rendered screenshot.
10. Integrate only after tests, review, and acceptance criteria pass. Preserve unrelated dirty changes.
11. Record durable project state in the relevant `AGENTS.md`, `MEMORY.md`, or `memory/daily/` note. Update Trello for significant project work when the integration is available.

## Routing model

- T0: direct, read-only, or one-file work. Execute in the main session.
- T1: bounded implementation. Use one worker only when delegation adds value.
- T2: multi-file or moderate-risk work. Use architect, implementer, and verifier responsibilities.
- T3: high-risk, destructive, financial, publishing, deployment, or multi-project work. Require explicit approval gates, isolated worktrees, independent verification, and final acceptance.

Prefer the smallest graph that can prove the result. Parallelize only nodes with disjoint ownership and no unmet dependency.

## Zo routing

- Use `bin/zo-run` or the token-saver wrapper for verbose command families.
- Use Graphify for codebase retrieval, dependency questions, and file relationships.
- Use the Zo browser or `agent-browser` for authenticated interaction and screenshot verification.
- Use Zo app integrations instead of browser automation when a connected integration supports the action.
- Use `zo/ask` only for self-contained bounded subtasks and pass the current model explicitly.
- Treat API routes, hosted pages, live services, and external apps as separate approval surfaces.

## Task graph contract

Write the graph as JSON and validate it with:

```bash
bun run Skills/zo-conductor/scripts/validate_task_graph.ts graph.json
```

Read `references/task-graph-schema.md` for the contract and `references/repository-bases.md` for the design lineage.

## Completion report

Report: result, changed files, selected agents, verification evidence, unresolved blockers, and one or two prioritized next improvements. Do not claim completion when a required screenshot, test, approval, or integration step is missing.
