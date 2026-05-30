# HyperFrames House Style

Use this only when the project lacks explicit animation direction. Visual identity still comes from `DESIGN.md` or `visual-style.md`.

## Default motion

- First scene motion starts at 0.15s.
- Primary headline: `y: 48`, `opacity: 0`, `duration: 0.72`, `ease: "expo.out"`.
- Supporting text: `y: 28`, `opacity: 0`, `duration: 0.52`, `ease: "power3.out"`.
- Cards: `y: 36`, `scale: 0.96`, `opacity: 0`, `duration: 0.56`, `ease: "back.out(1.25)"`.
- Small labels: `y: 14`, `opacity: 0`, `duration: 0.34`, `ease: "power2.out"`.
- Decoratives: slower, lower opacity, ambient only after content is readable.

## Default spacing

Use a 4px base scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 160.

For 1920x1080:

- Safe outer padding: 96-160px.
- Dense data padding: 72-112px.
- Caption bottom safe area: 96-140px.

For 1080x1920:

- Safe outer padding: 72-96px.
- Keep primary content between 18% and 78% of height unless the format is intentionally poster-like.

## Default text hierarchy

- Hero title: 96-150px.
- Section title: 64-96px.
- Body: 28-42px.
- Caption: 34-48px.
- Label: 18-24px.

## Default visual treatment

- Prefer solid canvas plus localized glow, grain, or physical texture.
- Avoid full-screen dark linear gradients.
- Use depth layers: background texture, soft shape, main content, annotations, transition layer.
- Keep accents constrained. One accent should do a job, not wander around like a lost intern.
