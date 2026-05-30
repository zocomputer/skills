# Wiring Blocks

Blocks are standalone sub-compositions.

## Include pattern

```html
<div
  data-composition-id="data-chart"
  data-composition-src="compositions/data-chart.html"
  data-start="2"
  data-duration="15"
  data-track-index="1"
  data-width="1920"
  data-height="1080"
></div>
```

## Required checks

- `data-composition-id` matches the block's internal composition ID.
- `data-composition-src` points to the installed file.
- `data-start` aligns with host timeline and transitions.
- `data-duration` fits the host scene.
- Same-track clips do not overlap.
- CSS `z-index` handles visual layer; `data-track-index` is timing track, not z-order.

## Do not

- Manually add the block timeline to the parent timeline.
- Wrap media inside timed containers that fight the framework.
- Assume CLI paste snippets are finished.
