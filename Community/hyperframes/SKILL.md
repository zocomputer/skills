---
name: hyperframes
description: |
  Primary workflow skill for creating and editing HyperFrames videos: HTML compositions with data-* timing attributes, GSAP timelines, CSS layout, scene transitions, validation, visual inspection, and preview handoff. Use whenever the user asks to make, edit, validate, storyboard, or render a HyperFrames video.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Video
---

# HyperFrames

## Usage

Install this skill into your Zo workspace and the agent will route HyperFrames video work through it. Invoke implicitly by asking for a new HyperFrames project, edits to an existing composition, animation map / inspection, or video validation. The skill loads only the references it needs per task — start with `references/composition-contract.md` for any new HTML, `references/visual-identity-gate.md` before writing styles, and `references/quality-checks.md` before handing the project back.

Companion skills: `gsap`, `hyperframes-cli`, `hyperframes-registry`, `website-to-video`. Install the ones you need; this skill calls out which one applies per step.

HyperFrames videos are authored as HTML. The HTML is the source of truth: data attributes define timing, CSS defines the finished frame, and GSAP defines motion. The framework owns clip visibility, media playback, and timeline sync.

## Always start here

For any new or significant video task:

1. Read the project docs if the video already exists: `README.md`, `DESIGN.md`, `visual-style.md`, `SCRIPT.md`, `STORYBOARD.md`, and existing composition HTML.
2. Read `references/composition-contract.md` before writing or editing composition HTML.
3. Read `references/visual-identity-gate.md` before any new composition.
4. For multi-scene work, read `references/transitions.md`.
5. For text-heavy work, read `references/typography.md`.
6. Use the companion skills as needed:
   - `gsap` for tween/timeline choreography.
   - `hyperframes-cli` for scaffold/lint/inspect/preview/render.
   - `hyperframes-registry` for `hyperframes add`, blocks, and components.
   - `website-to-video` when starting from a URL.

Small edits may skip the full workflow, but not the relevant rule. A color tweak still must respect `DESIGN.md`. A timing tweak still must preserve the timeline contract.

## Core workflow

1. **What** — define what the viewer should experience: narrative arc, key moments, emotional beats.
2. **Structure** — decide compositions, sub-compositions, tracks, captions, overlays, audio, and video.
3. **Timing** — determine clip durations, transitions, beat pacing, and which media drives length.
4. **Layout** — build the end-state first. Every scene must look correct as static HTML/CSS at its hero frame before animation.
5. **Animate** — add entrances, transitions, and final-scene exits using GSAP.
6. **Validate** — run lint, validate, inspect, and animation-map when applicable.
7. **Preview handoff** — give the HyperFrames Studio URL first. Render MP4 only when explicitly requested.

## Non-negotiables

- Every composition must have a visual identity source: `DESIGN.md`, `visual-style.md`, or explicit user direction.
- Layout comes before animation. CSS defines the final visible position; GSAP animates from or to that state.
- All timelines use `{ paused: true }` and register synchronously at `window.__timelines[compositionId]`.
- Duration comes from `data-duration`, not empty GSAP tweens.
- Video is muted and `playsinline`; audio uses a separate `<audio>` element.
- Use `data-track-index`, never `data-layer`. Use `data-duration`, never `data-end`.
- No `Math.random()`, `Date.now()`, async timeline construction, `setTimeout`, promises, or media `.play()`/`.pause()` calls.
- No `repeat: -1`; calculate finite repeat counts.
- Do not animate layout properties when transforms work.
- Do not animate a video element's dimensions. Animate a wrapper.
- Multi-scene compositions always use transitions. No jump cuts.
- Every scene element enters via `gsap.from()`. No fully-formed elements appearing from nowhere.
- No exit animations before scene transitions. The transition is the exit. Only the final scene may fade or animate out.
- Do not use `<template>` in a standalone root `index.html`. Use `<template>` only for sub-composition files.

## Output checklist

Before calling work done:

- `npx hyperframes lint` passes.
- `npx hyperframes validate` passes with zero errors; contrast warnings are addressed, not ignored.
- `npx hyperframes inspect` passes, or intentional overflows are marked with `data-layout-allow-overflow` / `data-layout-ignore`.
- For new compositions or major animation work, run the animation map and review every flag.
- Provide the active Studio URL: `http://localhost:<port>/#project/<project-name>`.
- Do not label `index.html` as the preview surface. It is source code, not the project handoff.

## Reference map

- `references/composition-contract.md` — timing attributes, composition structure, media rules, timeline contract.
- `references/visual-identity-gate.md` — required design source before writing HTML.
- `references/layout-before-animation.md` — static hero-frame-first layout process.
- `references/transitions.md` — multi-scene transition rules and patterns.
- `references/typography.md` — typography, fitText, caption/text sizing rules.
- `references/quality-checks.md` — lint, validate, inspect, contrast, animation-map.
- `references/captions.md` — captions, subtitles, lyrics, and karaoke timing.
- `references/tts.md` — text-to-speech workflow.
- `references/audio-reactive.md` — audio-reactive animation guidance.
- `references/css-patterns.md` — deterministic CSS/GSAP emphasis effects.
- `references/motion-principles.md` — choreography, pacing, easing, and anti-patterns.
- `references/visual-styles.md` — named visual styles for generating `DESIGN.md`.
- `references/house-style.md` — default motion/sizing/style when no style is provided.
- `references/patterns.md` — PiP, title cards, slideshow, data, and product patterns.
