---
name: ontoly-software-graph
description: |
  Use Ontoly to build and query a deterministic Software Graph before manually searching a TypeScript repository. Use when the user asks about architecture, dependency impact, request traces, routes, services, modules, configuration usage, dead code, framework structure, or codebase onboarding. The skill keeps software understanding in Ontoly: verify the graph, check trust and diagnostics, query the CLI or MCP capabilities, cite graph evidence, and inspect files only when Ontoly cannot answer.
compatibility: Created for Zo Computer
metadata:
  author: 0xsarwagya
  origin: https://github.com/0xsarwagya/ontoly
---

# Ontoly Software Graph

Use this skill when a user asks software architecture or codebase-understanding questions and the target project can be analyzed by Ontoly.

Ontoly builds a deterministic Software Graph. Your workflow is to consume that graph first, not rebuild understanding with ad hoc repository search.

## Workflow

1. Verify whether an Ontoly graph exists in the repository.
2. If the graph is missing or stale, ask before making changes and run:

```bash
ontoly build .
```

3. Check diagnostics, graph trust, graph hash, and framework detection before answering.
4. Prefer Ontoly CLI or MCP capabilities for architecture, dependency, trace, route, service, module, configuration, and impact questions.
5. Cite concrete evidence from the graph: node IDs, edge types, routes, packages, source locations, diagnostics, and confidence.
6. Only inspect source files when the graph cannot answer, the graph reports low confidence, or the user explicitly asks for source-level review.
7. Clearly separate measured graph facts from inferred observations.

## Useful Commands

```bash
ontoly build .
ontoly inspect
ontoly graph
ontoly trace
ontoly mcp
```

## Answer Style

Always include:

- The graph evidence used.
- Any diagnostics or low-confidence areas that affect the answer.
- The confidence basis, derived from graph evidence.
- A fallback note when source inspection was required.

Do not invent architecture relationships. If Ontoly cannot prove a relationship, say so and recommend the next query or validation step.
