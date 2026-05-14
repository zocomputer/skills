---
name: hyperframes-cli
description: |
  Command workflow for HyperFrames projects using npx hyperframes: init, lint, validate, inspect, preview, render, transcribe, TTS, doctor, and handoff URLs. Use whenever operating the HyperFrames CLI.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Video
---

# HyperFrames CLI

## Usage

Use this skill whenever the workflow requires `npx hyperframes` commands — scaffolding (`init`), validation (`lint`, `validate`, `inspect`), preview, render, TTS, transcription, or diagnostics. Requires Node 22+ and network access on first run. The full command surface lives in `references/commands.md`; consult it before running anything other than the obvious `lint`/`validate`/`inspect`.

Everything runs through `npx hyperframes`. Requires Node.js >= 22 and FFmpeg.

## Standard workflow

1. Scaffold: `npx hyperframes init <project>`.
2. Author HTML/CSS/GSAP composition using the `hyperframes` skill.
3. Lint: `npx hyperframes lint`.
4. Validate: `npx hyperframes validate`.
5. Visual inspect: `npx hyperframes inspect`.
6. Preview: `npx hyperframes preview --port <port>`.
7. Render only on explicit request: `npx hyperframes render`.

Lint and inspect before preview. Render after preview approval unless the user explicitly asked for an MP4.

## Scaffold

```bash
npx hyperframes init my-video
npx hyperframes init my-video --example warm-grain
npx hyperframes init my-video --video clip.mp4
npx hyperframes init my-video --audio track.mp3
npx hyperframes init my-video --non-interactive
```

Templates: `blank`, `warm-grain`, `play-mode`, `swiss-grid`, `vignelli`, `decision-tree`, `kinetic-type`, `product-promo`, `nyt-graph`.

Use `init` instead of hand-building a project. It creates structure, copies media, can transcribe audio, and installs AI coding skills.

## Lint and validate

```bash
npx hyperframes lint
npx hyperframes lint ./my-project
npx hyperframes lint --verbose
npx hyperframes lint --json

npx hyperframes validate
npx hyperframes validate --no-contrast
```

Lint catches missing `data-composition-id`, overlapping tracks, bad attributes, and unregistered timelines. Validate includes WCAG contrast checks by default.

## Visual inspect

```bash
npx hyperframes inspect
npx hyperframes inspect ./my-project
npx hyperframes inspect --json
npx hyperframes inspect --samples 15
npx hyperframes inspect --at 1.5,4,7.25
```

Use this after lint and validate, especially with speech bubbles, cards, captions, tight typography, and dynamic text. `npx hyperframes layout` is a compatibility alias.

## Preview handoff

```bash
npx hyperframes preview
npx hyperframes preview --port 4567
```

When handing a project back, report the Studio project URL:

```text
http://localhost:<port>/#project/<project-name>
```

Use the actual port from preview output and the project directory name. Do not hand off `index.html` as the preview surface.

## Rendering

```bash
npx hyperframes render
npx hyperframes render --output final.mp4
npx hyperframes render --quality draft
npx hyperframes render --fps 60 --quality high
npx hyperframes render --format webm
npx hyperframes render --docker
```

Quality guidance: draft for iteration, standard for review, high for final delivery. 60fps roughly doubles render cost.

## Audio, transcription, and TTS

```bash
npx hyperframes transcribe audio.mp3
npx hyperframes transcribe video.mp4 --model medium.en --language en
npx hyperframes transcribe subtitles.srt
npx hyperframes transcribe subtitles.vtt
npx hyperframes transcribe openai-response.json

npx hyperframes tts "Text here" --voice af_nova --output narration.wav
npx hyperframes tts script.txt --voice bf_emma
npx hyperframes tts --list
```

## Troubleshooting

```bash
npx hyperframes doctor
npx hyperframes browser
npx hyperframes info
npx hyperframes upgrade
npx hyperframes compositions
npx hyperframes docs
npx hyperframes benchmark .
```

Run `doctor` first if rendering fails. Common issues: missing FFmpeg, missing Chrome, low memory, wrong Node version.

## Reference

Read `references/commands.md` for command details and flags.
