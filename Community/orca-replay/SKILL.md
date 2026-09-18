---
name: orca-replay
description: >-
  Read a local recording of a past agent run to answer what it actually did,
  then re-run that recording offline with no model provider contacted. Use when
  a long Zo task failed partway through and nobody knows which step broke it,
  when a reported failure cannot be reproduced by hand, or when a failed run
  should become an offline regression instead of a paragraph in a chat log.
metadata:
  author: xizhuomengcontin
  category: Community
---

# Orca Replay

Zo agents run long tasks: they call tools, write files, run commands, and keep going while nobody is watching. When the result is wrong hours later, the workspace shows the end state but not the step that produced it, and asking the agent what it did gets an answer built from a summary of its own context window — the tool results and exit codes are already gone.

[OrcaReplay](https://github.com/Continuum-AI-Corp/OrcaReplay) writes those runs down. It sits between the agent and its model provider and records the real traffic — prompts, tool calls, responses, raw bytes — into a local trace file, then replays that trace offline. Apache-2.0, Node 20+, npm package `orcareplay`, command `orca`.

## When to Use

- A long-running task ended in a state nobody can explain.
- "Which step changed this file?" / "Which command broke the build?"
- A failure was reported that you cannot reproduce by hand.
- You want to re-run a failed task on a different model and compare, without re-doing the work from scratch.

**Do not use** for planning the next change, reviewing a diff, or debugging code no agent ran. This skill only reads runs that already happened.

## Setup

```bash
node --version                          # Node 20+
npm install -g orcareplay               # exposes `orca`
orca list                               # newest first; empty means nothing to read
```

Recording happens out of process: the agent is launched as a child process with its provider origin redirected for that process only, so the program captured is the program as it really ran.

## Workflow

1. **Confirm a recording exists.** `orca list`. If it is empty, say so and offer to start one — do not reconstruct the run from memory or from a pasted log.
2. **Classify the question.**
   - *What happened?* → `orca show` — model turns with token counts and stop reasons, tool calls with arguments and results, shell commands with exit codes, every file changed.
   - *Why did it happen?* → `orca graph --to <seq>` — only the causal chain that produced that one event.
   - *Does it still reproduce?* → `orca replay`.
   - *Would another model do better?* → `orca checkpoints`, then `orca compare`.
3. **Keep recorded and inferred apart.** Every edge from `orca graph` is labelled `recorded` (the recorder watched it) or `inferred` (derived at query time from a named rule). Write them differently:
   - "The trace shows the `rm` at step 14 removed it."
   - "This looks like the `rm` at step 14, going by timing — that edge is inferred, not recorded."
   Flattening both into one confident sentence is the failure this workflow exists to prevent.
4. **Before any replay, list the recorded shell commands.** A replay is not a dry run; the commands run again. Say what will repeat, and where.
5. **Replay into a scratch directory**, not the live workspace, so an interrupted replay cannot leave the recorded file tree restored over current work.
6. **Report the `reused=n/m` line verbatim**, then the residual uncertainty. A replay proves the recording is self-consistent, not that a fresh run would fail again.

## Fringe Cases

- **Empty trace.** Not "nothing happened" — nothing was captured, usually an agent that pins its own provider origin.
- **`reused=3/5`.** Usually not a partial failure: harnesses make calls for themselves (a quota probe, a session-naming request) and a replay does not repeat them.

## Related

- Upstream: https://github.com/Continuum-AI-Corp/OrcaReplay
