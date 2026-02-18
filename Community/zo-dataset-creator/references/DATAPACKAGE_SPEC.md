# datapackage.json Reference

Reference for the `datapackage.json` file format used in Zo Datasets.

---

## Overview

`datapackage.json` follows the [Frictionless Data Package](https://frictionlessdata.io/specs/patterns/) standard. It marks a directory as a Zo Dataset and provides metadata.

---

## Required Fields

### name (required)

Dataset identifier. Should be lowercase with hyphens only.

```json
{
  "name": "youtube-playlist-videos"
}
```

**Rules:**
- Lowercase letters only
- Use hyphens for spaces
- No spaces or underscores
- Unique across all datasets

### resources (required)

Array of database resource objects. Defines the database file(s).

```json
{
  "resources": [
    {
      "path": "data.duckdb"
    }
  ]
}
```

**Minimal example:**

```json
{
  "name": "my-dataset",
  "resources": [
    {
      "path": "data.duckdb"
    }
  ]
}
```

---

## Optional Fields

### title

Human-readable dataset name.

```json
{
  "title": "YouTube Playlist Videos"
}
```

### description

Detailed description of the dataset.

```json
{
  "description": "Track every video in your watchlist playlist, store its metadata, transcript, and AI-friendly tags inside a DuckDB dataset so Zo can query it later."
}
```

### version

Dataset version (semantic versioning recommended).

```json
{
  "version": "1.0.0"
}
```

### keywords

Array of keywords/tags for discoverability.

```json
{
  "keywords": ["youtube", "playlist", "videos", "transcripts", "duckdb"]
}
```

### homepage

URL to the original data source.

```json
{
  "homepage": "https://www.youtube.com/playlist?list=PLfq7lKfKfdwlnzjKzecYbg0OIfjXBXPUs"
}
```

### licenses

Array of license objects.

```json
{
  "licenses": [
    {
      "name": "Creative Commons Attribution",
      "path": "https://creativecommons.org/licenses/by/4.0/",
      "title": "CC-BY 4.0"
    }
  ]
}
```

---

## Resource Fields

Each resource in the `resources` array can have these fields:

### path (required)

Path to the database file (usually `"data.duckdb"`).

```json
{
  "path": "data.duckdb"
}
```

### name

Resource name (typically the table name).

```json
{
  "name": "playlist_videos"
}
```

### title

Human-readable resource title.

```json
{
  "title": "Playlist Videos"
}
```

### description

Resource description.

```json
{
  "description": "Table of YouTube playlist videos with metadata and transcripts"
}
```

### format

File format (e.g., `"duckdb"`).

```json
{
  "format": "duckdb"
}
```

### mediatype

IANA media type.

```json
{
  "mediatype": "application/vnd.sqlite3"
}
```

### encoding

Character encoding.

```json
{
  "encoding": "utf-8"
}
```

---

## Complete Example

```json
{
  "name": "youtube-playlist-videos",
  "title": "YouTube Playlist Videos",
  "description": "Track every video in your watchlist playlist, store its metadata, transcript, and AI-friendly tags inside a DuckDB dataset so Zo can query it later.",
  "version": "1.0.0",
  "keywords": ["youtube", "playlist", "videos", "transcripts", "duckdb"],
  "homepage": "https://www.youtube.com/playlist?list=PLfq7lKfKfdwlnzjKzecYbg0OIfjXBXPUs",
  "licenses": [
    {
      "name": "Creative Commons Attribution"
    }
  ],
  "resources": [
    {
      "name": "playlist_videos",
      "path": "data.duckdb",
      "title": "Playlist Videos",
      "description": "Table of YouTube playlist videos with metadata and transcripts",
      "format": "duckdb",
      "mediatype": "application/vnd.sqlite3",
      "encoding": "utf-8"
    }
  ]
}
```

---

## Minimal Example

Smallest valid `datapackage.json`:

```json
{
  "name": "my-dataset",
  "resources": [
    {
      "path": "data.duckdb"
    }
  ]
}
```

---

## Common Patterns

### Single Table Dataset

```json
{
  "name": "sales-data",
  "resources": [
    {
      "name": "sales",
      "path": "data.duckdb"
    }
  ]
}
```

### Multi-Table Dataset

```json
{
  "name": "analytics",
  "resources": [
    {
      "name": "users",
      "path": "data.duckdb"
    },
    {
      "name": "sessions",
      "path": "data.duckdb"
    },
    {
      "name": "events",
      "path": "data.duckdb"
    }
  ]
}
```

---

## Validation

Use the `validate_dataset.py` script to check `datapackage.json`:

```bash
python3 /home/workspace/Skills/zo-dataset-creator/scripts/validate_dataset.py /home/workspace/Datasets/your-dataset
```

Common validation errors:
- Missing `name` field
- Missing `resources` array
- Invalid JSON format

---

## Best Practices

1. **Keep it simple** - Only include fields you need
2. **Use descriptive titles** - Human-readable names help users
3. **Add keywords** - Makes datasets discoverable
4. **Include homepage** - Link to original data source
5. **Specify licenses** - Clarify usage rights

---

## Resources

- [Frictionless Data Package Specification](https://frictionlessdata.io/specs/patterns/)
- [Data Package Registry](https://specs.frictionlessdata.io/schemas/tabular-data-package.json)
