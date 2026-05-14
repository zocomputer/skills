# Motion Principles

Motion is not decoration. It tells the viewer where to look and how to feel.

## Easing as emotion

- `power2.out` — clean, reliable, neutral.
- `power3.out` — confident entrance.
- `expo.out` — decisive, high-end, editorial.
- `back.out(1.2-1.7)` — playful or tactile.
- `elastic.out(1, 0.3)` — use sparingly; it can become clown furniture.
- `sine.inOut` — ambient, breathing, gentle loops.
- `none` — mechanical, data, scanline, progress.

## Timing as weight

- Fast objects feel light.
- Slow objects feel heavy or important.
- 0.2s is a flick.
- 0.5-0.8s is a readable entrance.
- 1.0s+ is cinematic or heavy. Use intentionally.

## Choreography as hierarchy

The most important element should either move first, move most, or settle last. Do not animate everything with identical timing unless the point is synchronized force.

## Scene pacing

- Give the first scene 0.1-0.3s before first motion.
- Avoid dead zones longer than 1s unless holding for narration or emphasis.
- Layer motion: primary, secondary, ambient.
- Do not make every element bounce. The viewer has eyes, not a pinball machine.

## Ambient motion

Ambient motion should be finite in HyperFrames. Calculate repeat count from duration:

```js
const cycleDuration = 2.4;
const repeats = Math.ceil(sceneDuration / cycleDuration) - 1;
tl.to(".orb", { y: -12, duration: cycleDuration / 2, yoyo: true, repeat: repeats, ease: "sine.inOut" }, 0);
```

Never use `repeat: -1`.

## Anti-patterns

- Same entrance on every element.
- Animating layout properties instead of transforms.
- Hiding outgoing scenes before transitions.
- Slow fades everywhere.
- Motion without narrative purpose.
- Motion so busy it fights narration.
