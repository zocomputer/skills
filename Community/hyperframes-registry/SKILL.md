---
name: hyperframes-registry
description: |
  Use when working with the HyperFrames registry, `hyperframes add`, blocks, components, registry manifests, install locations, or wiring installed HyperFrames items into a composition.
compatibility: Created for Zo Computer
metadata:
  author: jeffkazzee.zo.computer
  category: Video
---

# HyperFrames Registry

## Usage

Use this skill when the agent should install or wire HyperFrames blocks/components instead of writing them from scratch. Start with `references/discovery.md` to inspect the registry manifest, then `references/wiring-blocks.md` for sub-composition installs or `references/wiring-components.md` for snippet installs. `references/install-locations.md` covers the on-disk layout `hyperframes add` uses.

The registry provides reusable blocks and components installable with `hyperframes add <name>`.

## When to use

Use this skill when:

- The user mentions `hyperframes add`, blocks, components, registry, or `hyperframes.json`.
- CLI output from `hyperframes add` appears in the session.
- You need to wire an installed item into an existing composition.
- You want to discover what is available in the registry.

## Blocks vs components

- **Blocks** are standalone sub-compositions. They have their own dimensions, duration, and timeline. Include them with `data-composition-src`.
- **Components** are effect snippets. They do not own dimensions. Paste their HTML/CSS/JS into a host composition.

## Quick commands

```bash
hyperframes add data-chart
hyperframes add grain-overlay
hyperframes add data-chart --dir .
hyperframes add data-chart --json
hyperframes add data-chart --no-clipboard
```

The CLI prints written files and a paste snippet. The snippet is only a starting point. You still need to add or verify `data-composition-id`, `data-start`, `data-duration`, `data-track-index`, `data-width`, and `data-height`.

## Install locations

By default:

- Blocks: `compositions/<name>.html`
- Components: `compositions/components/<name>.html`

Configurable in `hyperframes.json`:

```json
{
  "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
  "paths": {
    "blocks": "compositions",
    "components": "compositions/components",
    "assets": "assets"
  }
}
```

## Wiring a block

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

`data-composition-id` must match the block's internal composition ID.

## Wiring a component

1. Read the installed component file, usually `compositions/components/<name>.html`.
2. Copy HTML elements into the host composition's `div[data-composition-id]`.
3. Copy styles into the host style block.
4. Copy script content before your timeline code if the component has JS.
5. If the snippet exposes timeline integration hooks, add those calls to the host timeline.

## Discovery

```bash
curl -s https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/registry.json
```

Each `registry-item.json` contains name, type, title, description, tags, dimensions, duration, and file list.

## References

- `references/discovery.md` — finding items by type and tag.
- `references/wiring-blocks.md` — complete block wiring rules.
- `references/wiring-components.md` — component paste and timeline integration.
- `references/install-locations.md` — custom registry paths.
