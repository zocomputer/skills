# Step 7 — Validate and Deliver

Goal: prove the project works before handoff.

## Required commands

```bash
npx hyperframes lint
npx hyperframes validate
npx hyperframes inspect
```

For new or major animation work:

```bash
node /home/workspace/Skills/hyperframes/scripts/animation-map.mjs <project-dir> --out <project-dir>/.hyperframes/anim-map
```

If the script does not exist in this workspace, use project-local tooling or note that animation-map was unavailable.

## Preview

```bash
npx hyperframes preview --port <port>
```

Deliver the Studio project URL:

```text
http://localhost:<port>/#project/<project-name>
```

Do not deliver `index.html` as the preview link.

## Render

Only render MP4 when explicitly requested:

```bash
npx hyperframes render --quality high --fps 60 --output final.mp4
```

## Final report

Include:

- Studio URL.
- Validation status.
- Any remaining warnings and why they are acceptable.
- Render status only if MP4 was requested.
