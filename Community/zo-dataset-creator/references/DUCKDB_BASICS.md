# DuckDB Basics for Zo Datasets

Quick reference for working with DuckDB in Zo Datasets.

---

## Connecting to Database

### Python

```python
import duckdb

# Connect (creates file if it doesn't exist)
con = duckdb.connect("data.duckdb")

# Read-only connection
con = duckdb.connect("data.duckdb", read_only=True)

# Always close when done
con.close()
```

### Command Line

```bash
# Connect and enter interactive shell
duckdb data.duckdb

# Run single query
duckdb data.duckdb -c "SHOW TABLES"

# Run queries from file
duckdb data.duckdb < queries.sql
```

---

## Creating Tables

```python
import duckdb

con = duckdb.connect("data.duckdb")

# Basic table
con.execute("""
    CREATE TABLE videos (
        id VARCHAR PRIMARY KEY,
        title VARCHAR,
        duration INTEGER
    )
""")

# Table with COMMENT annotations
con.execute("""
    CREATE TABLE videos (
        id VARCHAR PRIMARY KEY COMMENT 'YouTube video ID',
        title VARCHAR COMMENT 'Video title from YouTube metadata',
        duration INTEGER COMMENT 'Duration in seconds',
        published_at TIMESTAMP COMMENT 'When the video was published'
    ) COMMENT 'Collection of videos from the watchlist playlist'
""")

con.close()
```

---

## Inserting Data

```python
# Insert single row
con.execute("INSERT INTO videos VALUES ('abc123', 'My Video', 120)")

# Insert multiple rows
con.execute("""
    INSERT INTO videos VALUES
        ('abc123', 'My Video', 120, '2024-01-01 10:00:00'),
        ('def456', 'Another Video', 180, '2024-01-02 12:00:00')
""")

# Insert from CSV
con.execute("CREATE TABLE sales AS SELECT * FROM 'source/sales.csv'")

# Insert from JSON
con.execute("CREATE TABLE users AS SELECT * FROM read_json('source/users.json')")
```

---

## Querying Data

```python
# Select all
con.execute("SELECT * FROM videos").fetchall()

# Select specific columns
con.execute("SELECT title, duration FROM videos").fetchall()

# Filter
con.execute("SELECT * FROM videos WHERE duration > 120").fetchall()

# Sort
con.execute("SELECT * FROM videos ORDER BY published_at DESC").fetchall()

# Limit
con.execute("SELECT * FROM videos LIMIT 10").fetchall()

# Aggregate
con.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
con.execute("SELECT AVG(duration) FROM videos").fetchone()[0]
```

---

## Common Data Types

| Type | Description | Example |
|------|-------------|---------|
| `VARCHAR` | Text/string | `'Hello World'` |
| `INTEGER` | 32-bit integer | `42` |
| `BIGINT` | 64-bit integer | `1234567890` |
| `DOUBLE` | Floating-point | `3.14159` |
| `TIMESTAMP` | Date and time | `'2024-01-01 10:00:00'` |
| `BOOLEAN` | True/false | `true` or `false` |
| `DATE` | Date only | `'2024-01-01'` |
| `TIME` | Time only | `'10:00:00'` |
| `TEXT` | Large text | `'Long content...'` |

---

## COMMENT Annotations

Add descriptions to tables and columns for documentation:

```python
# Table comment
con.execute("""
    COMMENT ON TABLE videos IS 'YouTube videos from watchlist playlist'
""")

# Column comments
con.execute("""
    COMMENT ON COLUMN videos.title IS 'Video title from YouTube metadata'
""")

con.execute("""
    COMMENT ON COLUMN videos.view_count IS 'Total view count'
""")

# View comments
con.execute("""
    SELECT table_name, comment
    FROM duckdb_tables()
    WHERE schema_name = 'main'
""").fetchall()

con.execute("""
    SELECT column_name, comment
    FROM duckdb_columns()
    WHERE schema_name = 'main' AND table_name = 'videos'
""").fetchall()
```

---

## Schema Queries

```python
# List all tables
con.execute("SHOW TABLES").fetchall()

# Describe a table
con.execute("DESCRIBE videos").fetchall()

# Get table metadata
con.execute("""
    SELECT table_name, comment
    FROM duckdb_tables()
    WHERE schema_name = 'main'
""").fetchall()

# Get column metadata
con.execute("""
    SELECT column_name, data_type, comment
    FROM duckdb_columns()
    WHERE schema_name = 'main' AND table_name = 'videos'
""").fetchall()
```

---

## Modifying Tables

```python
# Add column
con.execute("ALTER TABLE videos ADD COLUMN like_count BIGINT")

# Drop column
con.execute("ALTER TABLE videos DROP COLUMN like_count")

# Rename column
con.execute("ALTER TABLE videos RENAME COLUMN title TO video_title")

# Drop table
con.execute("DROP TABLE videos")
```

---

## Importing Data

### From CSV

```python
# Create table from CSV
con.execute("CREATE TABLE sales AS SELECT * FROM 'source/sales.csv'")

# Read CSV with options
con.execute("""
    CREATE TABLE sales AS SELECT * FROM 'source/sales.csv'
    (header true, delimiter ',')
""")
```

### From JSON

```python
# Read JSON array
con.execute("CREATE TABLE users AS SELECT * FROM read_json('source/users.json')")

# Read JSON lines
con.execute("""
    CREATE TABLE events AS SELECT * FROM read_json('source/events.json',
        format='json_lines'
    )
""")
```

### From Other Databases

```python
# Import from SQLite
con.execute("ATTACH 'source/database.sqlite' AS sqlite_db")
con.execute("CREATE TABLE data AS SELECT * FROM sqlite_db.main.table_name")
```

---

## Exporting Data

```python
# Export to CSV
con.execute("COPY (SELECT * FROM videos) TO 'output/videos.csv' (header true)")

# Export to JSON
con.execute("COPY (SELECT * FROM videos) TO 'output/videos.json'")
```

---

## Common Queries

### Count rows

```python
row_count = con.execute("SELECT COUNT(*) FROM videos").fetchone()[0]
print(f"Total videos: {row_count}")
```

### Get date range

```python
result = con.execute("""
    SELECT
        MIN(published_at) as earliest,
        MAX(published_at) as latest
    FROM videos
""").fetchone()
print(f"Date range: {result[0]} to {result[1]}")
```

### Group and aggregate

```python
results = con.execute("""
    SELECT
        channel_title,
        COUNT(*) as video_count,
        AVG(duration) as avg_duration
    FROM videos
    GROUP BY channel_title
    ORDER BY video_count DESC
""").fetchall()
```

### Join tables

```python
results = con.execute("""
    SELECT
        v.title,
        v.duration,
        s.view_count
    FROM videos v
    JOIN stats s ON v.id = s.video_id
""").fetchall()
```

---

## Working with Dates

```python
# Current timestamp
con.execute("SELECT CURRENT_TIMESTAMP").fetchone()[0]

# Extract components
con.execute("""
    SELECT
        EXTRACT(YEAR FROM published_at) as year,
        EXTRACT(MONTH FROM published_at) as month,
        EXTRACT(DAY FROM published_at) as day
    FROM videos
""").fetchall()

# Date arithmetic
con.execute("""
    SELECT
        title,
        published_at,
        published_at + INTERVAL '7 days' as week_later
    FROM videos
""").fetchall()
```

---

## Upsert (Update or Insert)

```python
# Insert or update based on primary key
con.execute("""
    INSERT OR REPLACE INTO videos (id, title, duration)
    VALUES ('abc123', 'Updated Title', 150)
""")
```

---

## Performance Tips

1. **Use indexes** for frequently queried columns:
   ```python
   con.execute("CREATE INDEX idx_published ON videos(published_at)")
   ```

2. **Use columnar storage** for large datasets:
   ```python
   con.execute("SET enable_progress_bar=false")
   ```

3. **Batch inserts** for better performance:
   ```python
   con.executemany(
       "INSERT INTO videos (id, title, duration) VALUES (?, ?, ?)",
       [('id1', 'title1', 120), ('id2', 'title2', 180)]
   )
   ```

---

## Troubleshooting

### Database locked

```python
# Ensure all connections are closed
con.close()

# Use read-only connection for queries
con = duckdb.connect("data.duckdb", read_only=True)
```

### File not found

```python
# Check file exists before connecting
from pathlib import Path
db_path = Path("data.duckdb")
if not db_path.exists():
    print("Database not found")
```

### Query errors

```python
try:
    result = con.execute("SELECT * FROM videos").fetchall()
except Exception as e:
    print(f"Query failed: {e}")
```

---

## Resources

- [DuckDB Documentation](https://duckdb.org/docs/)
- [DuckDB SQL Reference](https://duckdb.org/docs/sql/introduction)
- [DuckDB Python API](https://duckdb.org/docs/api/python/overview.html)
