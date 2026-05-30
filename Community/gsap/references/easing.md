# GSAP Easing

Built-ins: `power1`-`power4`, `back`, `bounce`, `circ`, `elastic`, `expo`, `sine`. Most support `.in`, `.out`, and `.inOut`.

## Practical choices

- `power1.out` — default, mild.
- `power2.out` — clean UI motion.
- `power3.out` — strong entrance.
- `power4.out` — dramatic snap.
- `expo.out` — premium, decisive.
- `sine.inOut` — ambient loops and floating.
- `back.out(1.2)` — tactile card entrance.
- `back.out(1.7)` — playful; use carefully.
- `elastic.out(1, 0.3)` — special effect only.
- `none` — progress bars, scanning, mechanical motion.

## Rule

Vary eases inside a scene when multiple elements enter. Reusing one ease everywhere makes the frame feel generated rather than directed.
