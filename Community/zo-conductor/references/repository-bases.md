# Repository bases

This skill combines ideas from several public repositories. These are design references, not runtime dependencies.

| Repository | Adopted basis | Deliberately not adopted |
|---|---|---|
| [wshobson/agents](https://github.com/wshobson/agents) | Broad reusable agent roles and multi-harness compatibility | Its marketplace scale and static role catalog |
| [alp82/forge](https://github.com/alp82/forge) | Complexity-aware routing, staged execution, and explicit capability limits | Any provider-specific assumptions |
| [andyyaro/orkestra](https://github.com/andyyaro/orkestra) | Isolated worktrees, measured agent capability, and explicit acceptance | An independent orchestration daemon |
| [realgarit/fable-baton](https://github.com/realgarit/fable-baton) | Frontier planner with lower-cost bounded workers and benchmark-minded evaluation | Claude-only tier names |
| [codejunkie99/fable-orchestrator](https://github.com/codejunkie99/fable-orchestrator) | Small local-first planner/worker separation and dependency-light installation | Silent overwrites, unverified model assumptions, and lack of end-to-end checks |

## Zo-specific additions

Zo adds workspace instruction routing, memory continuity, Graphify retrieval, token-efficient command execution, Trello visibility, app integrations, screenshot-based frontend verification, and explicit boundaries around deployment, external messages, secrets, and destructive actions.

## Evidence boundary

Repository stars, forks, activity, and README claims are adoption signals only. They do not prove correctness. This skill treats passing tests, isolated changes, rendered verification, and explicit acceptance as the completion evidence.
