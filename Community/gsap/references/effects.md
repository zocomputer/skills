# GSAP Effects

## Typewriter text

Use for short phrases only. Long typewriter copy is usually a pacing crime.

```js
const text = "Built with Zo.";
const el = document.querySelector(".typewriter");
tl.to({ n: 0 }, {
  n: text.length,
  duration: 1.1,
  ease: "none",
  onUpdate() {
    el.textContent = text.slice(0, Math.round(this.targets()[0].n));
  }
}, 0.4);
```

## Audio visualizer bars

Use finite repeats or explicit beat timing. No random heights unless seeded.

```js
const bars = gsap.utils.toArray(".bar");
tl.to(bars, {
  scaleY: (i) => [0.4, 0.9, 0.6, 1.0, 0.5][i % 5],
  transformOrigin: "50% 100%",
  duration: 0.18,
  stagger: 0.035,
  yoyo: true,
  repeat: 8,
  ease: "sine.inOut"
}, 0.2);
```

## Directional rotation

Use directional suffixes:

```js
gsap.to(".dial", { rotation: "360_cw", duration: 1.2 });
gsap.to(".needle", { rotation: "-170_short", duration: 0.6 });
```
