# Layout Before Animation

Position every element where it should be at its most visible moment: the hero frame. Write static HTML and CSS first. Add GSAP only after the layout works.

## Why

If you position elements at their animated start state, offscreen or invisible, you are guessing the final layout. Overlaps and clipping appear only after render. Build the end state first so layout problems are visible before motion hides them.

## Process

1. Identify the hero frame for each scene: the moment when the most important elements are simultaneously visible.
2. Write static CSS for that frame.
3. Ensure `.scene-content` fills the scene:

```css
.scene-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 120px 160px;
  gap: 24px;
  box-sizing: border-box;
}
```

4. Use padding to push content inward. Do not absolutely position a main content container with hardcoded `top` and `left`.
5. Use `position: absolute` for decoratives, overlays, and depth layers only.
6. Add entrances with `gsap.from()` from offscreen/invisible to the CSS position.
7. Add exits only on the final scene. For multi-scene videos, transitions handle scene exits.

## Wrong

```css
.scene-content {
  position: absolute;
  top: 200px;
  left: 160px;
  width: 1920px;
  height: 1080px;
}
```

This breaks across canvas sizes and causes overflow when content changes.

## Correct entrance pattern

```js
tl.from(".title", { y: 60, opacity: 0, duration: 0.6, ease: "power3.out" }, 0.2);
tl.from(".subtitle", { y: 40, opacity: 0, duration: 0.5, ease: "power2.out" }, 0.45);
tl.from(".logo", { scale: 0.8, opacity: 0, duration: 0.4, ease: "back.out(1.4)" }, 0.65);
```

CSS defines the landing positions. Tween values define the journey.

## Intentional overlap

Layered glow, shadows, cards, z-stacks, highlight marks, and depth layers may overlap intentionally. The layout pass catches accidental overlap: headline over stat, label under card, caption off-frame, etc.
