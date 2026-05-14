# GSAP Performance

## Prefer compositor-safe properties

Use:

- `x`
- `y`
- `scale`
- `rotation`
- `opacity`
- `autoAlpha`

Avoid when possible:

- `width`
- `height`
- `top`
- `left`
- layout-heavy box changes

## `will-change`

Use only on elements that animate:

```css
.card { will-change: transform; }
```

Do not blanket `will-change` across the page.

## Frequent updates

Use `gsap.quickTo()` for pointer-driven or frequent updates:

```js
const xTo = gsap.quickTo("#id", "x", { duration: 0.4, ease: "power3" });
const yTo = gsap.quickTo("#id", "y", { duration: 0.4, ease: "power3" });
container.addEventListener("mousemove", (e) => {
  xTo(e.pageX);
  yTo(e.pageY);
});
```

## Cleanup

Store tween/timeline return values when controlling playback. Kill animations when no longer needed.

```js
const tween = gsap.to(".box", { x: 100 });
tween.kill();
```
