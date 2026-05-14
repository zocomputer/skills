---
name: website-to-video
description: |
  Capture a website and turn it into a professional HyperFrames video. Use when the user asks to make a product launch video, product tour, social ad, brand reel, or teaser from a URL.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Video
---

# Website to Video

## Usage

Use this skill end-to-end when the user wants a video from a URL. It assumes the `hyperframes`, `gsap`, and `hyperframes-cli` skills are also installed. Each step has its own reference (`references/step-1-capture.md` through `references/step-7-validate.md`); read the relevant one before the step, do the work, hit the gate, then advance. Do not skip the `DESIGN.md`/`SCRIPT.md`/`STORYBOARD.md` artifacts — they are the difference between a real video and a screen recording with delusions of grandeur.

Use this skill when the user says things like:

- "Capture https://... and make me a 25-second product launch video."
- "Turn this website into a 15-second social ad for Instagram."
- "Create a 30-second product tour from https://..."

The workflow has seven gated steps. Each step produces an artifact that gates the next. Do not skip documents because the video will otherwise become a pretty screen recording with delusions of grandeur.

## Seven-step workflow

### 1. Capture and understand

Read `references/step-1-capture.md`.

Run the capture, read extracted data, and build a working summary using the write-down-and-forget method.

Gate: print the site summary:

- name
- top colors
- fonts
- key assets
- one-sentence vibe

### 2. Write `DESIGN.md`

Read `references/step-2-design.md`.

Write a simple brand reference for the captured website. Six sections, about 90 lines. This is the cheat sheet, not the creative plan.

Gate: `DESIGN.md` exists in the project directory.

### 3. Write `SCRIPT.md`

Read `references/step-3-script.md`.

Write the narration script. Scene durations come from narration, not guessing.

Gate: `SCRIPT.md` exists in the project directory.

### 4. Write `STORYBOARD.md`

Read `references/step-4-storyboard.md` and, for technique ideas, `references/techniques.md`.

Write beat-by-beat creative direction: mood, camera, animation, transitions, assets, depth layers, SFX, and an asset audit.

Gate: `STORYBOARD.md` exists with beat-by-beat direction and an asset audit table.

### 5. Generate VO and map timing

Read `references/step-5-vo.md`.

Generate TTS audio, transcribe word timings, and map timestamps to beats. Update `STORYBOARD.md` with real durations.

Gate: `narration.wav` or `narration.mp3` exists, transcript JSON exists, and beat timings are updated.

### 6. Build compositions

Read the `hyperframes` skill and `references/step-6-build.md`.

Build each composition from the storyboard. After each composition, self-review layout, asset placement, and animation quality.

Gate: every composition self-reviewed. No overlapping elements, misplaced assets, or static images without motion.

### 7. Validate and deliver

Read `references/step-7-validate.md`.

Run lint, validate, inspect, and preview. Deliver the localhost Studio project URL first:

```text
http://localhost:<port>/#project/<project-name>
```

Only render MP4 on explicit request.

Gate: `npx hyperframes lint` and `npx hyperframes validate` pass with zero errors, and the final response includes the active Studio project URL.

## Video type defaults

| Type | Duration | Beats | Narration |
|---|---:|---:|---|
| Social ad | 10-15s | 3-4 | Optional hook sentence |
| Product demo | 30-60s | 5-8 | Full narration |
| Feature announcement | 15-30s | 3-5 | Full narration |
| Brand reel | 20-45s | 4-6 | Optional, music focus |
| Launch teaser | 10-20s | 2-4 | Minimal, high energy |

## Format defaults

- Landscape: 1920x1080
- Portrait: 1080x1920
- Square: 1080x1080

Ask only if the format affects the work. If the user said Instagram Stories or TikTok, use portrait. If they said launch video or product tour, use landscape unless otherwise specified.

## References

- `references/step-1-capture.md`
- `references/step-2-design.md`
- `references/step-3-script.md`
- `references/step-4-storyboard.md`
- `references/step-5-vo.md`
- `references/step-6-build.md`
- `references/step-7-validate.md`
- `references/techniques.md`
