---
name: zo-goal-loop
description: Recreates Claude Code's /goal and /loop commands — define a completion condition and let Zo work autonomously until it's achieved. Supports iterative task execution with evaluator model checking for completion.
metadata:
  author: jaknyfe.zo.computer
  category: Utility
  display-name: Zo Goal Loop
compatibility: Created for Zo Computer. Requires ZO_CLIENT_IDENTITY_TOKEN environment variable.
---

# Zo Goal Loop

Run Zo autonomously until a goal is achieved.

## Usage

### /goal — Work until condition met

```bash
bun run /home/workspace/Skills/zo-goal-loop/scripts/goal.ts "completion condition here"
```

Examples:
- `"All tests pass and lint is clean"`
- `"Build completes successfully"`
- `"Find 3 working solutions to the problem"`

Optional args:
- `--max-turns=<n>` — Stop after N turns (default: unlimited)
- `--save-to=<file.md>` — Log progress to file

### /loop — Run prompt repeatedly

```bash
bun run /home/workspace/Skills/zo-goal-loop/scripts/loop.ts "prompt" [options]
```

Options:
- `--interval=<ms>` — Wait between iterations (default: 5000)
- `--max-iterations=<n>` — Stop after N loops (default: unlimited)
- `--until="<condition>"` — Stop when condition is met (file check, output match, etc.)

## How it works

1. `/goal` calls the Zo `/zo/ask` API with the task
2. Each turn runs the task model
3. After each turn, an evaluator model (Haiku) checks if the condition is met
4. If not met, generates next action and continues
5. If met, reports completion and any artifacts

## Verification commands

- Check progress: `cat /tmp/zo-goal-progress.log`
- View current goal: `cat /tmp/current-goal.txt`
- Force stop: `rm /tmp/current-goal.txt`

## Requirements

- `ZO_CLIENT_IDENTITY_TOKEN` must be available in environment