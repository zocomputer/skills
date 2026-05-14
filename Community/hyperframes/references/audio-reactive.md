# Audio-Reactive Animation

Use this when visuals should respond to music, voice, or sound.

## Rules

- Keep it deterministic and seekable.
- Precompute audio features when possible instead of live random behavior.
- Map only a few properties: scale, y, opacity, glow strength, stroke width, or CSS variables.
- Do not let audio-reactive motion compete with captions or narration.

## Bands

- Low band: bass, impact, scale pulses, shadow bloom.
- Mid band: voice/body, card emphasis, waveform thickness.
- High band: sparkle, line flicker, particle accents.

## Good mappings

```js
tl.to(".pulse", { scale: 1.08, duration: 0.12, ease: "power2.out" }, beatTime);
tl.to(".pulse", { scale: 1, duration: 0.22, ease: "sine.out" }, beatTime + 0.12);
```

Use exact beat times from analysis or transcript. Avoid frame-by-frame noise unless the effect is intentionally raw.
