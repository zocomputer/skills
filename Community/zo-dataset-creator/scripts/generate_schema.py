#!/usr/bin/env python3
"""
Generate schema.yaml from data.duckdb.

Reads table and column metadata (including COMMENT annotations) from the DuckDB
database and writes a structured YAML schema file in the format expected by the
Zo Datasets UI.

Usage:
    python3 generate_schema.py

The script expects data.duckdb to exist in the same directory.
"""

from pathlib import Path

import duckdb
import yaml


DB_PATH = Path(__file__).parent / "data.duckdb"
SCHEMA_PATH = Path(__file__).parent / "schema.yaml"


def get_schema(con: duckdb.DuckDBPyConnection) -> dict:
    tables_result = con.execute("""
        SELECT table_name, comment
        FROM duckdb_tables()
        WHERE schema_name = 'main'
        ORDER BY table_name
    """).fetchall()

    schema = {"tables": []}

    for table_name, table_comment in tables_result:
        columns_result = con.execute(
            """
            SELECT column_name, data_type, comment
            FROM duckdb_columns()
            WHERE schema_name = 'main' AND table_name = ?
            ORDER BY column_index
        """,
            [table_name],
        ).fetchall()

        row_count = con.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]

        columns = []
        for col_name, col_type, col_comment in columns_result:
            col_entry = {"name": col_name, "type": col_type}
            if col_comment:
                col_entry["description"] = col_comment
            columns.append(col_entry)

        table_entry = {
            "name": table_name,
            "row_count": row_count,
            "columns": columns,
        }
        if table_comment:
            table_entry["description"] = table_comment

        schema["tables"].append(table_entry)

    return schema


def main():
    if not DB_PATH.exists():
        print(f"Error: {DB_PATH} not found. Run ingest.py first.")
        return

    con = duckdb.connect(str(DB_PATH), read_only=True)
    schema = get_schema(con)
    con.close()

    with open(SCHEMA_PATH, "w") as f:
        yaml.dump(schema, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

    print(f"Generated {SCHEMA_PATH}")


if __name__ == "__main__":
    main()
