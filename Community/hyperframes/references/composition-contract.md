# HyperFrames Composition Contract

## Source of truth

A HyperFrames video is HTML. A composition is an HTML file with:

- `data-*` attributes for timing and media sync.
- CSS for final visual layout.
- A GSAP timeline for animation.

The framework handles clip visibility, media playback, and timeline sync.

## Data attributes

### All clips

| Attribute | Required | Values |
|---|---:|---|
| `id` | yes | Unique identifier |
| `data-start` | yes | Seconds or clip ID reference: `"el-1"`, `"intro + 2"` |
| `data-duration` | required for img/div/compositions | Seconds. Video/audio defaults to media duration. |
| `data-track-index` | yes | Integer. Same-track clips cannot overlap. |
| `data-media-start` | no | Trim offset into source, seconds |
| `data-volume` | no | 0-1, default 1 |

`data-track-index` does not control visual stacking. Use CSS `z-index`.

### Composition clips

| Attribute | Required | Values |
|---|---:|---|
| `data-composition-id` | yes | Unique composition ID |
| `data-start` | yes | Root composition uses `0` |
| `data-duration` | yes | Takes precedence over GSAP timeline length |
| `data-width` / `data-height` | yes | `1920x1080`, `1080x1920`, etc. |
| `data-composition-src` | no | Path to external HTML file |

## Standalone vs sub-composition structure

Standalone `index.html` must not wrap the root composition in `<template>`:

```html
<body>
  <div data-composition-id="main" data-start="0" data-duration="10" data-width="1920" data-height="1080">
    <!-- content -->
  </div>
</body>
```

Sub-compositions loaded via `data-composition-src` use a `<template>` wrapper:

```html
<template id="my-comp-template">
  <div data-composition-id="my-comp" data-width="1920" data-height="1080">
    <!-- content -->
    <style>
      [data-composition-id="my-comp"] { }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["my-comp"] = tl;
    </script>
  </div>
</template>
```

Root inclusion:

```html
<div
  id="el-1"
  data-composition-id="my-comp"
  data-composition-src="compositions/my-comp.html"
  data-start="0"
  data-duration="10"
  data-track-index="1"
></div>
```

## Video and audio

Video must be muted and `playsinline`. Audio is always separate:

```html
<video id="el-v" data-start="0" data-duration="30" data-track-index="0" src="video.mp4" muted playsinline></video>
<audio id="el-a" data-start="0" data-duration="30" data-track-index="2" src="video.mp4" data-volume="1"></audio>
```

Add `crossorigin="anonymous"` to external media.

## Timeline contract

- All timelines start `{ paused: true }`.
- Register every timeline: `window.__timelines["<composition-id>"] = tl`.
- Framework auto-nests sub-timelines. Do not manually add them.
- Duration comes from `data-duration`, not GSAP timeline length.
- Never create empty tweens to set duration.

## Never do this

- Forget `window.__timelines` registration.
- Use video for audio.
- Nest video inside a timed div. Use a non-timed wrapper.
- Use `data-layer`; use `data-track-index`.
- Use `data-end`; use `data-duration`.
- Animate video element dimensions. Animate a wrapper.
- Call media play/pause/seek.
- Create a top-level container without `data-composition-id`.
- Use `repeat: -1`.
- Build timelines asynchronously.
- Use `gsap.set()` on future clip elements at page load; use `tl.set()` at or after the clip start.
- Use `<br>` in normal content text. Let text wrap via max-width. Exception: deliberate short display titles.
