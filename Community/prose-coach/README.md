# Prose Coach FREE

A focused starter skill for cleaning obvious AI-writing defaults inside an LLM.

## What it catches

FREE checks five vocabulary categories:

- AI-default vocabulary
- Transition crutches
- Filler openings and framing
- Hedging
- Empty professional language

It also checks three structural patterns: rhetorical question followed by its answer, restatement loops, and repeated symmetrical lists.

The skill applies one basic cleanup pass. It does not include detector scoring, root-word tables, content-specific routing, voice-preservation rules, or the full revision protocol.

## Install

In Claude Code:

```bash
/plugin marketplace add kyledylanconner/prose-coach-skill
/plugin install prose-coach@Kyle-Conner
```

Or copy the `prose-coach` folder into your LLM's skills directory.

## Use

Paste a draft and ask:

> Check this for obvious AI-writing patterns and clean it up.

## Free vs. PRO

| | FREE | PRO ($39 one-time) |
|---|---|---|
| Vocabulary | 5 common categories | Full pattern system |
| Structure | 3 common patterns | Expanded structural diagnosis |
| Revision | One basic cleanup pass | Complete three-pass protocol |
| Content routing | No | Yes |
| Voice-preservation rules | No | Yes |
| Detector scoring | No | Density and burstiness analysis |

[Get PRO at prose.coach](https://prose.coach)
