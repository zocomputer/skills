---
name: bangers
description: >
  Social-media content system. Use whenever the request is about making content: what to post,
  content ideas, hooks, titles, thumbnails, YouTube or short-form video scripts, X/Bluesky threads,
  LinkedIn or Substack or newsletter posts, Facebook Group posts, Instagram or LinkedIn carousels,
  technical explainers and tutorials, video edit plans and captions, repurposing one source across
  platforms, or checking whether a draft reads as AI-written and how to disclose AI use. Studies
  public creator and platform mechanics and adapts them to the author's own audience and voice.
homepage: https://github.com/Jeff-Kazzee/bangers
license: MIT
metadata:
  author: Jeff Kazzee
  generated: scripts/build-zo-skill.mjs
  source: https://github.com/Jeff-Kazzee/bangers
  suite: bangers
  version: "1.1.0"
---

# BANGERS

A research-backed social-media content system. It studies public creator and
platform behavior, extracts reusable mechanics, and turns real source material
into native assets without copying anyone's voice.

This is the Zo Computer build. Zo has no plugin system, so the twelve
procedures live under `references/procedures/` instead of as separate skills.
Load one procedure at a time. Do not read them all.

## Router

Pick one procedure, read it completely, then load only the references it names.

| Request | Procedure |
| --- | --- |
| Research a creator, platform, format, or writing pattern | `references/procedures/banger-research.md` |
| Ideas, angles, or a content calendar | `references/procedures/banger-ideas.md` |
| Hooks, titles, thumbnails, or packaging | `references/procedures/banger-hooks.md` |
| Technical explainer, tutorial, build log, or how-it-works teaching content | `references/procedures/banger-explainer.md` |
| YouTube or long-form video script | `references/procedures/banger-script-longform.md` |
| Short vertical script | `references/procedures/banger-script-shorts.md` |
| X, Twitter, or Bluesky post or thread | `references/procedures/banger-threads.md` |
| LinkedIn, Substack, newsletter, or Facebook Group post | `references/procedures/banger-longform-written.md` |
| Instagram or LinkedIn carousel | `references/procedures/banger-carousels.md` |
| Cut sheet, captions, markers, reframe, or recording plan | `references/procedures/banger-edit.md` |
| One source adapted to several platforms | `references/procedures/banger-repurpose.md` |
| AI detector check, authenticity verification, or AI-use disclosure | `references/procedures/banger-detector.md` |

## Before drafting anything

1. Start from a real source, observation, result, or a clearly named audience
   question. Never invent proof, experience, metrics, quotes, or current
   platform facts.
2. Read `references/frameworks/voice-and-audience.md` to fix who is speaking
   and who they are speaking to, then
   `references/frameworks/writing-quality.md` for the failure list.
3. When the piece teaches a mechanism the reader must repeat, also read
   `references/frameworks/technical-clarity.md` and apply the frame/payload
   split: the author's voice carries the hook, story, and judgment, while the
   explanation takes one name per concept, one idea per sentence, and active
   voice.

## Suite rules

1. Research updates need dated sources, observed examples, a confidence label,
   and a reusable mechanic. One viral post does not establish a law. Treat any
   platform claim without a current entry in
   `references/research/source-ledger.md` as unverified and research it first.
2. Borrow mechanics, not phrasing, identity, signature jokes, or an imitation
   voice.
3. Adapt every output to its native platform. Never paste identical copy
   everywhere.
4. Detector results are weak adversarial evidence. Never damage a true, clear
   passage to move a score, and never claim output passes AI detection. Route
   detector and disclosure work through
   `references/procedures/banger-detector.md`.
5. Keep private client, identity, health, financial, and unpublished business
   context out of anything reusable.

## Checking a draft

The deterministic writing checker runs in the Zo terminal. It reads UTF-8 files
and can enforce an author's em-dash ban:

```
node scripts/check-writing.mjs --no-em-dash draft.md
```

It prompts human review. It does not prove authorship or quality.

## Output

Lead with the strongest ready-to-use asset. Then give only the source
assumptions, platform notes, and the approval needed next. Drafting is free.
Publishing, scheduling, and outreach need the author's explicit per-item
approval.

## Credit

Creator playbooks study public work by Fireship, Matt Pocock, Theo, and
ThePrimeagen. The technical-clarity standard is adapted from ASD-STE100
Simplified Technical English and Orwell's six rules, and reached this project
through @geogristle, @Voxyz_ai, and @mikehostetler on X. Full credit in
`references/frameworks/technical-clarity.md`.

MIT licensed. Source and updates: https://github.com/Jeff-Kazzee/bangers
