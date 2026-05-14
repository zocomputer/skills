# GSAP Timeline Patterns

## Default timeline

```js
const tl = gsap.timeline({
  paused: true,
  defaults: { duration: 0.5, ease: "power2.out" }
});
```

## Position parameter

```js
tl.to(".a", { x: 100 }, 0);
tl.to(".b", { y: 50 }, "<");
tl.to(".c", { opacity: 0 }, "<0.2");
tl.to(".d", { scale: 1.1 }, "+=0.4");
```

Use labels for scenes:

```js
tl.addLabel("scene-1", 0);
tl.from("#s1-title", { y: 48, opacity: 0 }, "scene-1+=0.2");
tl.addLabel("scene-2", 6.8);
tl.from("#s2-title", { x: -40, opacity: 0 }, "scene-2+=0.25");
```

## Nesting timelines

```js
const master = gsap.timeline({ paused: true });
const child = gsap.timeline();
child.to(".a", { x: 100 }).to(".b", { y: 50 });
master.add(child, 0);
```

In HyperFrames, do not manually add sub-composition timelines to a parent. The framework auto-nests them.

## Playback control

```js
tl.play();
tl.pause();
tl.reverse();
tl.restart();
tl.time(2);
tl.progress(0.5);
tl.kill();
```
