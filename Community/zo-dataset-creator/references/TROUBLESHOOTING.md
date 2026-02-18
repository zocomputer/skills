# Troubleshooting Zo Datasets

Common issues and solutions for Zo Datasets that don't display correctly in the UI.

---

## Tables Not Showing in Zo UI

### Symptom

Dataset exists in [Datasets](/?t=datasets) but clicking on it shows "No tables found" or tables are missing.

### Causes and Solutions

#### 1. Missing or Invalid `schema.yaml`

**Problem:** `schema.yaml` doesn't exist or is in wrong format.

**Solution:**

```bash
cd /home/workspace/Datasets/your-dataset
python3 generate_schema.py
```

**Check format:** Ensure `schema.yaml` uses list format:

```yaml
# Correct
tables:
- name: my_table
  row_count: 10
  columns:
  - name: id
    type: VARCHAR

# Wrong (nested dict - won't work)
tables:
  my_table:
    columns:
      id:
        type: VARCHAR
```

#### 2. Stale Schema After Database Changes

**Problem:** Modified database structure but didn't regenerate schema.

**Solution:** Re-run schema generation after any database changes:

```bash
python3 generate_schema.py
```

**When to re-run:**
- Added or removed columns
- Created new tables
- Changed column types
- Updated COMMENT annotations

#### 3. Missing `datapackage.json`

**Problem:** Dataset directory exists but `datapackage.json` is missing.

**Solution:** Create `datapackage.json` with required fields:

```json
{
  "name": "your-dataset",
  "title": "Your Dataset",
  "resources": [
    {
      "path": "data.duckdb"
    }
  ]
}
```

---

## Schema Format Errors

### Error: "schema.yaml tables is not a list"

**Cause:** Schema uses nested dictionary format instead of list format.

**Solution:** Re-generate schema with `generate_schema.py`. Never write `schema.yaml` manually.

### Error: Missing 'name' field in tables or columns

**Cause:** Schema is missing required field names.

**Solution:** Check `schema.yaml` format:

```yaml
tables:
- name: table_name        # Required
  columns:
  - name: column_name      # Required
    type: VARCHAR          # Required
```

---

## Database Issues

### Error: "data.duckdb is not a valid DuckDB database"

**Cause:** File is corrupted or not a DuckDB database.

**Solution:**

1. Verify file is a database:
   ```bash
   duckdb /home/workspace/Datasets/your-dataset/data.duckdb -c "SHOW TABLES"
   ```

2. If corrupted, recreate database from source files.

### Error: "Conflicting lock is held"

**Cause:** Database is locked by another process.

**Solution:**

1. Close all DuckDB connections
2. Restart Zo workspace if needed
3. Check for background processes using the database

---

## Validation Errors

### Using the Validator

```bash
python3 /home/workspace/Skills/zo-dataset-creator/scripts/validate_dataset.py /home/workspace/Datasets/your-dataset
```

### Common Validation Messages

| Error | Solution |
|-------|----------|
| `datapackage.json not found` | Create `datapackage.json` with name and resources |
| `data.duckdb not found` | Create DuckDB database in dataset directory |
| `schema.yaml not found` | Run `python3 generate_schema.py` |
| `schema.yaml tables is not a list` | Re-generate schema - do not edit manually |
| `Table exists in database but not in schema` | Run `python3 generate_schema.py` |

---

## Workflow Issues

### Script Can't Find Database

**Problem:** Ingestion script fails with "data.duckdb not found"

**Solution:** Run scripts from dataset directory:

```bash
cd /home/workspace/Datasets/your-dataset
python3 ingest/ingest.py
```

### Schema Generated Before Database

**Problem:** Empty schema (`tables: []`) because `generate_schema.py` ran before database creation.

**Solution:** Re-run after creating database:

```bash
python3 generate_schema.py
```

---

## Checklist for Fixing Datasets

When a dataset doesn't display correctly:

- [ ] `datapackage.json` exists with `name` and `resources` fields
- [ ] `data.duckdb` exists and is readable
- [ ] `data.duckdb` contains at least one table
- [ ] `schema.yaml` exists
- [ ] `schema.yaml` uses list format (`- name:` for tables and columns)
- [ ] Run `python3 generate_schema.py` to ensure schema is up-to-date
- [ ] Run `python3 validate_dataset.py` to verify structure
- [ ] Refresh [Datasets](/?t=datasets) page in browser

---

## Getting Help

If issues persist:

1. Validate dataset: `python3 validate_dataset.py /path/to/dataset`
2. Check database: `duckdb data.duckdb -c "SHOW TABLES"`
3. Check schema format: Ensure list format with `name:` keys
4. Re-generate schema: `python3 generate_schema.py`

See [SCHEMA_GUIDE.md](SCHEMA_GUIDE.md) for schema formatting details.
