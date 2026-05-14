# Quality Checks

Run these before handing back a HyperFrames project.

## Required commands

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
```

For new compositions and significant animation changes, also run the animation map:

```bash
node /home/workspace/Skills/hyperframes/scripts/animation-map.mjs <composition-dir> --out <composition-dir>/.hyperframes/anim-map
```

If the project has its own installed animation-map script, use the project-local version.

## Lint

Lint catches structural problems:

- Missing `data-composition-id`.
- Overlapping same-track clips.
- Bad timing attributes.
- Unregistered timelines.
- Deprecated attributes like `data-layer` or `data-end`.

Fix errors. Warnings should be fixed unless explicitly justified.

## Validate and contrast

`npx hyperframes validate` runs WCAG contrast audit by default. It seeks to sampled timestamps, screenshots the page, samples background pixels behind text, and computes contrast ratios.

If warnings appear:

- On dark backgrounds: brighten failing text color until it clears 4.5:1 for normal text or 3:1 for large text.
- On light backgrounds: darken it.
- Stay in the palette family. Adjust existing colors instead of inventing new ones.
- Re-run validate until clean.

Use `--no-contrast` only for rapid iteration, never final delivery.

## Visual inspect

```bash
npx hyperframes inspect --json
npx hyperframes inspect --samples 15
npx hyperframes inspect --at 1.5,4,7.25
```

Fix:

- Text spilling outside cards, bubbles, or canvas.
- Fixed-width or fixed-height boxes clipping text.
- Children escaping clipping containers.
- Captions or labels moving off-frame.

Fixes usually mean increasing container size or padding, reducing font size or letter spacing, adding `max-width`, or using `window.__hyperframes.fitTextFontSize(...)`.

If overflow is intentional:

- Add `data-layout-allow-overflow` to the element or ancestor.
- Add `data-layout-ignore` to decoratives that should not be audited.

## Animation map review

Read `animation-map.json`. Check:

- Per-tween summaries.
- ASCII Gantt chart for choreography rhythm.
- Stagger intervals.
- Dead zones longer than 1s.
- Element lifecycle: first/last animation time and final visibility.
- Scene snapshots at key timestamps.
- Flags: offscreen, collision, invisible, paced-fast, paced-slow.

Fix or justify every flag. Do not hand back mystery choreography.
