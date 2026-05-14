# Install Locations

Default registry paths:

- Blocks: `compositions/<name>.html`
- Components: `compositions/components/<name>.html`
- Assets: `assets/`

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

When targeting a specific project:

```bash
hyperframes add grain-overlay --dir /path/to/project
```

Use `--json` when scripting and `--no-clipboard` in headless/CI contexts.
