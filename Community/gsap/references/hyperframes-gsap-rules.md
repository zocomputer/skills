# HyperFrames GSAP Rules

## Video-safe timeline construction

```js
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
window.__timelines["composition-id"] = tl;
```

Build synchronously. No `async`, `await`, promises, `setTimeout`, font loading waits, or timeline creation after page load. The capture engine reads `window.__timelines` synchronously.

## Allowed animation properties

Animate visual properties:

- `opacity`, `autoAlpha`
- `x`, `y`, `z`
- `scale`, `scaleX`, `scaleY`
- `rotation`, `rotationX`, `rotationY`
- `color`, `backgroundColor`
- `borderRadius`
- transforms and CSS variables

Do not animate `display` or framework-owned media playback state.

## Repeats

Never use `repeat: -1`.

```js
const repeat = Math.ceil(duration / cycleDuration) - 1;
tl.to(".orb", { y: -10, yoyo: true, repeat, duration: cycleDuration / 2 }, 0);
```

## Future clip elements

Do not use `gsap.set()` at page load on clip elements from later scenes. They may not exist yet.

Use timeline-positioned sets:

```js
tl.set("#later-scene .thing", { opacity: 0 }, sceneStart);
```

## Animation conflicts

Never animate the same property on the same element from multiple timelines simultaneously. If needed, split wrapper vs child:

- wrapper animates `x`/`y`
- child animates `scale`/`opacity`
