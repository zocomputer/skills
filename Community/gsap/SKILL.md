---
name: gsap
description: |
  GSAP animation reference for HyperFrames and frontend motion work. Use for tween methods, timeline sequencing, easing, transforms, stagger, matchMedia, cleanup, performance, and deterministic video-safe GSAP choreography.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Video
---

# GSAP Motion Reference

## Usage

Consult this skill any time the agent is writing or reviewing GSAP code, especially for HyperFrames video work. Load `references/hyperframes-gsap-rules.md` first when the target is a HyperFrames composition (capture-engine constraints make many normal GSAP idioms unsafe). Use `references/timeline-patterns.md` for sequencing, `references/easing.md` to choose curves with intent, `references/effects.md` for typewriter/visualizer/morph patterns, and `references/performance.md` before shipping motion-heavy work.

## Core tween methods

- `gsap.to(targets, vars)` — animate from current state to `vars`. Most common.
- `gsap.from(targets, vars)` — animate from `vars` to current state. Use for entrances.
- `gsap.fromTo(targets, fromVars, toVars)` — explicit start and end.
- `gsap.set(targets, vars)` — immediate set, duration 0.

Always use camelCase property names: `backgroundColor`, `rotationX`, `transformOrigin`.

## Common vars

- `duration` — seconds; default is 0.5.
- `delay` — seconds before start. Prefer timeline position parameters instead.
- `ease` — e.g. `power1.out`, `power3.inOut`, `back.out(1.7)`, `elastic.out(1, 0.3)`, `none`.
- `stagger` — number or object: `{ amount: 0.3, from: "center" }`, `{ each: 0.1, from: "random" }`.
- `overwrite` — `false`, `true`, or `"auto"`.
- `repeat` — number. In HyperFrames, never `-1`.
- `yoyo` — alternates direction with repeat.
- `onComplete`, `onStart`, `onUpdate` — callbacks.
- `immediateRender` — default true for `from()` / `fromTo()`. Set `false` on later tweens targeting the same property + element to avoid overwrite.

## Transform aliases

Prefer GSAP transform aliases over raw transform strings:

| GSAP property | Equivalent |
|---|---|
| `x`, `y`, `z` | `translateX/Y/Z` in px |
| `xPercent`, `yPercent` | translate in percent |
| `scale`, `scaleX`, `scaleY` | scale |
| `rotation` | rotate in degrees |
| `rotationX`, `rotationY` | 3D rotate |
| `skewX`, `skewY` | skew |
| `transformOrigin` | CSS transform origin |

Use `autoAlpha` instead of opacity when visibility should also toggle at 0. Use CSS variables like `"--hue": 180` when animating custom props.

## Timelines

Prefer timelines over chained delays.

```js
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: "power2.out" } });
tl.to(".a", { x: 100 })
  .to(".b", { y: 50 })
  .to(".c", { opacity: 0 });
```

Position parameter:

- `1` — absolute time at 1s.
- `"+=0.5"` — after previous end.
- `"-=0.2"` — before previous end.
- `"intro"`, `"intro+=0.3"` — labels.
- `"<"` — same start as previous.
- `">"` — after previous ends.
- `"<0.2"` — 0.2s after previous starts.

Use labels for readable sequencing:

```js
tl.addLabel("intro", 0);
tl.to(".a", { x: 100 }, "intro");
tl.addLabel("outro", "+=0.5");
tl.play("outro");
```

## HyperFrames-specific GSAP rules

- Timelines must be created synchronously and paused: `gsap.timeline({ paused: true })`.
- Register every timeline: `window.__timelines["composition-id"] = tl`.
- Do not call media playback methods.
- Do not animate `display` or `visibility`; use `autoAlpha` or opacity unless the framework owns visibility.
- Use `tl.set()` at or after clip start for later scene clip elements. Do not `gsap.set()` future clip elements at page load.
- Never use infinite repeats. Use `repeat: Math.ceil(duration / cycleDuration) - 1`.

## Performance

- Prefer `x`, `y`, `scale`, `rotation`, and `opacity`.
- Avoid `width`, `height`, `top`, and `left` when transforms can solve it.
- Use `will-change: transform` only on elements that actually animate.
- Use `stagger` instead of many manual tweens.
- Use `gsap.quickTo()` for frequent pointer or input updates.
- Kill offscreen or no-longer-needed animations.

## References

- `references/easing.md` — built-in eases and emotional use.
- `references/timeline-patterns.md` — labels, nesting, position parameter examples.
- `references/performance.md` — compositor-safe animation and cleanup.
- `references/hyperframes-gsap-rules.md` — video-safe GSAP constraints.
- `references/effects.md` — drop-in effects: typewriter text, audio visualizer, and reusable snippets.
