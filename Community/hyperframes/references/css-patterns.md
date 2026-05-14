# CSS + GSAP Emphasis Patterns

Use these for deterministic visual emphasis.

## Highlight sweep

HTML:

```html
<span class="mark">important phrase</span>
```

CSS:

```css
.mark {
  background: linear-gradient(90deg, var(--accent) 0 0) left bottom / 0% 0.24em no-repeat;
}
```

GSAP:

```js
tl.to(".mark", { backgroundSize: "100% 0.24em", duration: 0.42, ease: "power3.out" }, 1.2);
```

## Circle annotation

Use SVG with `stroke-dasharray` and animate `strokeDashoffset`.

## Burst

Use a fixed set of lines or dots. No random generation. If variety is needed, use a seeded PRNG.

## Sketchout

Animate clip-path or SVG stroke, but keep it readable. A scribble that hides the word is not emphasis; it is sabotage.
