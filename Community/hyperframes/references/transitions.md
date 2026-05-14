# Scene Transitions

Every multi-scene composition must use transitions. No jump cuts.

## Non-negotiables

1. Always use transitions between scenes.
2. Always use entrance animations on every scene.
3. Every element enters via `gsap.from()`.
4. Never use exit animations except on the final scene.
5. The outgoing scene must still be fully visible when the transition starts.
6. The transition is the exit.

## Wrong

```js
tl.to("#s1-title", { opacity: 0, y: -40, duration: 0.4 }, 6.5);
tl.to("#s1-subtitle", { opacity: 0, duration: 0.3 }, 6.7);
// transition fires on an empty scene
```

## Right

```js
tl.from("#s1-title", { y: 50, opacity: 0, duration: 0.7, ease: "power3.out" }, 0.3);
tl.from("#s1-subtitle", { y: 30, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.6);
// no exit tweens; transition handles scene change

tl.from("#s2-heading", { x: -40, opacity: 0, duration: 0.6, ease: "expo.out" }, 8.0);
```

## Transition types

Use the transition type that matches the scene energy:

- **Crossfade** — calm, editorial, reflective.
- **Wipe** — structured, product-demo, guide-like.
- **Mask reveal** — premium, cinematic, identity-driven.
- **Match cut** — same shape/object carries across scenes.
- **Light sweep / shader reveal** — high-energy or tech/launch material.
- **Card slide / pane shift** — UI, product tours, data explanations.

## Rules for choosing

- The transition should bridge narrative beats, not just hide a cut.
- Do not use the same transition repeatedly unless repetition is the aesthetic.
- Avoid full-screen linear gradients on dark backgrounds; H.264 banding makes them ugly. Use radial light, solids, texture, localized glow, or shader motion.
- If using shader transitions, read `@hyperframes/shader-transitions` package source instead of guessing from memory.

## Entrance guardrails

- Offset first animation 0.1-0.3s from scene start.
- Use at least three different eases per scene when there are enough elements.
- Do not repeat the same entrance pattern within a scene.
- Headlines: 60px+.
- Body: 20px+.
- Data labels: 16px+.
