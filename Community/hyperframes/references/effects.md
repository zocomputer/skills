# HyperFrames Effects

Use these as starting patterns when a project needs reusable visual effects. Prefer registry components when available.

## Typewriter

Use only for short text.

```js
const text = "Make the invisible obvious.";
const state = { n: 0 };
const el = document.querySelector(".typewriter");
tl.to(state, {
  n: text.length,
  duration: 1.1,
  ease: "none",
  onUpdate: () => {
    el.textContent = text.slice(0, Math.round(state.n));
  }
}, 0.4);
```

## Visualizer bars

Use deterministic values.

```js
const pattern = [0.4, 0.9, 0.62, 1, 0.55, 0.76];
tl.to(".bar", {
  scaleY: (i) => pattern[i % pattern.length],
  transformOrigin: "50% 100%",
  duration: 0.18,
  stagger: 0.035,
  yoyo: true,
  repeat: 8,
  ease: "sine.inOut"
}, 0.2);
```

## Grain overlay

Prefer a CSS texture or registry component. Mark decorative overlays with `data-layout-ignore` so inspect does not audit them.

## Light sweep

```css
.sweep::after {
  content: "";
  position: absolute;
  inset: -20%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent);
  transform: translateX(-120%) rotate(12deg);
}
```

```js
tl.to(".sweep::after", { xPercent: 240, duration: 0.9, ease: "power3.inOut" }, 2.1);
```

Pseudo-elements can be awkward to animate directly. If needed, use a real child element instead.
