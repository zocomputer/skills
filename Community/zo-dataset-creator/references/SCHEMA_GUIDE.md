# Schema Guide

Detailed explanation of the correct `schema.yaml` format for Zo Datasets.

---

## Overview

`schema.yaml` defines the structure of your dataset for the Zo UI. It must be **auto-generated** from the DuckDB database using `generate_schema.py`.

**CRITICAL:** Never write `schema.yaml` manually. Always generate it from the database.

---

## Correct Format

The Zo UI expects schema.yaml to use a list format with `name:` keys at the table and column level:

```yaml
tables:
- name: playlist_videos
  row_count: 4
  description: Table of YouTube playlist videos with metadata and transcripts
  columns:
  - name: playlist_id
    type: VARCHAR
    description: YouTube playlist ID
  - name: video_id
    type: VARCHAR
    description: YouTube video ID
  - name: title
    type: VARCHAR
    description: Video title
  - name: duration
    type: INTEGER
    description: Duration in seconds
  - name: published_at
    type: TIMESTAMP
    description: When the video was published
```

## Field Descriptions

### Table Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Table name (must match database table name) |
| `row_count` | Yes | Number of rows in the table |
| `description` | No | Table description (from COMMENT annotation) |
| `columns` | Yes | List of column definitions |

### Column Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Column name (must match database column name) |
| `type` | Yes | Column data type (VARCHAR, INTEGER, BIGINT, TIMESTAMP, etc.) |
| `description` | No | Column description (from COMMENT annotation) |

---

## Incorrect Format

Do NOT use nested dictionary format:

```yaml
# WRONG - Will NOT display in Zo UI
tables:
  playlist_videos:
    description: Table of YouTube playlist videos
    columns:
      playlist_id:
        type: VARCHAR
        nullable: True
        primary_key: True
      video_id:
        type: VARCHAR
```

**Problems with this format:**
- Uses nested dictionaries instead of lists
- Table name is a key, not a field
- Column names are keys, not fields
- Includes `nullable` and `primary_key` which Zo doesn't use

---

## Generating Schema

Use `generate_schema.py` to auto-generate the correct format:

```bash
cd /home/workspace/Datasets/your-dataset
python3 generate_schema.py
```

The script:
1. Connects to `data.duckdb`
2. Reads all tables from the database
3. Reads column names, types, and COMMENT annotations
4. Generates schema in correct list format
5. Writes to `schema.yaml`

---

## Adding Descriptions with COMMENT

Add descriptions to your tables and columns using DuckDB's COMMENT syntax. These are extracted into `schema.yaml`:

```python
import duckdb

con = duckdb.connect('data.duckdb')

# Add table comment
con.execute("""
    COMMENT ON TABLE videos IS 'YouTube videos from watchlist playlist'
""")

# Add column comments
con.execute("""
    COMMENT ON COLUMN videos.title IS 'Video title from YouTube metadata'
""")

con.execute("""
    COMMENT ON COLUMN videos.view_count IS 'Total view count'
""")

con.close()

# Now regenerate schema to include descriptions
# Run: python3 generate_schema.py
```

Result in `schema.yaml`:

```yaml
tables:
- name: videos
  row_count: 10
  description: YouTube videos from watchlist playlist
  columns:
  - name: title
    type: VARCHAR
    description: Video title from YouTube metadata
  - name: view_count
    type: BIGINT
    description: Total view count
```

---

## Common Data Types

| DuckDB Type | Description |
|-------------|-------------|
| `VARCHAR` | Text/string data |
| `INTEGER` | 32-bit integer |
| `BIGINT` | 64-bit integer |
| `DOUBLE` | Floating-point number |
| `TIMESTAMP` | Date and time |
| `BOOLEAN` | True/false values |
| `TEXT` | Large text field |

---

## When to Regenerate Schema

Always re-run `generate_schema.py` after:

1. **Creating a new database** - Initial schema generation
2. **Adding tables** - New tables need schema entries
3. **Adding/removing columns** - Column list changes
4. **Changing column types** - Type information updates
5. **Updating COMMENT annotations** - Descriptions change
6. **Deleting tables** - Remove entries from schema

---

## Schema from Example Database

Given this database creation:

```python
import duckdb

con = duckdb.connect('data.duckdb')

con.execute("""
    CREATE TABLE videos (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        duration INTEGER,
        published_at TIMESTAMP COMMENT 'When the video was published',
        view_count BIGINT COMMENT 'Total view count'
    ) COMMENT 'Collection of videos from the watchlist playlist'
""")

con.execute("""
    INSERT INTO videos VALUES
        ('abc123', 'My Video', 120, '2024-01-01 10:00:00', 1000),
        ('def456', 'Another Video', 180, '2024-01-02 12:00:00', 2500)
""")

con.close()
```

Running `generate_schema.py` produces:

```yaml
tables:
- name: videos
  row_count: 2
  description: Collection of videos from the watchlist playlist
  columns:
  - name: id
    type: VARCHAR
  - name: title
    type: VARCHAR
  - name: duration
    type: INTEGER
  - name: published_at
    type: TIMESTAMP
    description: When the video was published
  - name: view_count
    type: BIGINT
    description: Total view count
```

---

## Troubleshooting

### Schema has empty tables list

**Cause:** Ran `generate_schema.py` before creating the database.

**Solution:** Create database first, then re-run `generate_schema.py`.

### Schema missing new tables/columns

**Cause:** Database structure changed but schema wasn't regenerated.

**Solution:** Re-run `generate_schema.py` after database changes.

### Schema uses wrong format

**Cause:** Edited `schema.yaml` manually.

**Solution:** Re-generate with `generate_schema.py`. Never edit manually.

### Schema row_count is 0

**Cause:** Database table has no data.

**Solution:** This is expected if table is empty. Row count updates after adding data.

---

## Summary

1. **Always auto-generate schema** from database with `generate_schema.py`
2. **Never write schema.yaml manually** - format must be list with `name:` keys
3. **Use COMMENT annotations** to add descriptions to tables and columns
4. **Re-generate after database changes** - schema must stay in sync
5. **Validate with validator** - run `validate_dataset.py` to check format

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues.
