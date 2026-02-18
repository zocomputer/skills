#!/usr/bin/env python3
"""
Validate a Zo Dataset structure.

Checks that all required files exist and are correctly formatted.

Usage:
    python3 validate_dataset.py <path-to-dataset>
"""

import json
import sys
from pathlib import Path

import duckdb
import yaml


def validate_dataset(dataset_path: Path):
    """Validate a dataset structure."""

    errors = []
    warnings = []

    # Check directory exists
    if not dataset_path.exists():
        errors.append(f"Dataset directory not found: {dataset_path}")
        return errors, warnings

    # Check datapackage.json
    datapackage_path = dataset_path / "datapackage.json"
    if not datapackage_path.exists():
        errors.append("datapackage.json not found (required)")
    else:
        try:
            with open(datapackage_path) as f:
                datapackage = json.load(f)

            if "name" not in datapackage:
                errors.append("datapackage.json missing 'name' field")
            if "resources" not in datapackage:
                errors.append("datapackage.json missing 'resources' field")
            else:
                if not any(r.get("path") == "data.duckdb" for r in datapackage["resources"]):
                    errors.append("datapackage.json missing resource with path='data.duckdb'")

        except json.JSONDecodeError as e:
            errors.append(f"datapackage.json is not valid JSON: {e}")

    # Check data.duckdb
    db_path = dataset_path / "data.duckdb"
    if not db_path.exists():
        errors.append("data.duckdb not found (required)")
    else:
        try:
            con = duckdb.connect(str(db_path), read_only=True)
            tables = con.execute("SHOW TABLES").fetchall()
            con.close()

            if not tables:
                warnings.append("data.duckdb has no tables")

        except Exception as e:
            errors.append(f"data.duckdb is not a valid DuckDB database: {e}")

    # Check schema.yaml
    schema_path = dataset_path / "schema.yaml"
    if not schema_path.exists():
        errors.append("schema.yaml not found (required)")
    else:
        try:
            with open(schema_path) as f:
                schema = yaml.safe_load(f)

            if "tables" not in schema:
                errors.append("schema.yaml missing 'tables' key")
            else:
                # Check format - should be a list, not a dict
                if not isinstance(schema["tables"], list):
                    errors.append("schema.yaml tables is not a list - wrong format (should be auto-generated)")
                else:
                    # Check each table has required fields
                    for i, table in enumerate(schema["tables"]):
                        if "name" not in table:
                            errors.append(f"schema.yaml table {i} missing 'name' field")
                        if "columns" not in table:
                            errors.append(f"schema.yaml table {table.get('name', i)} missing 'columns' field")

                        # Check columns format
                        if "columns" in table and isinstance(table["columns"], list):
                            for j, col in enumerate(table["columns"]):
                                if "name" not in col:
                                    errors.append(f"schema.yaml column {j} in table {table.get('name', i)} missing 'name' field")
                                if "type" not in col:
                                    errors.append(f"schema.yaml column {col.get('name', j)} in table {table.get('name', i)} missing 'type' field")

        except yaml.YAMLError as e:
            errors.append(f"schema.yaml is not valid YAML: {e}")

    # Check if generate_schema.py exists (recommended)
    if not (dataset_path / "generate_schema.py").exists():
        warnings.append("generate_schema.py not found (recommended for schema generation)")

    # Compare schema tables with database tables
    if db_path.exists() and schema_path.exists() and not errors:
        try:
            con = duckdb.connect(str(db_path), read_only=True)
            db_tables = [t[0] for t in con.execute("SHOW TABLES").fetchall()]
            con.close()

            with open(schema_path) as f:
                schema = yaml.safe_load(f)

            schema_tables = [t.get("name") for t in schema.get("tables", [])]

            # Check for tables in database but not in schema
            for table in db_tables:
                if table not in schema_tables:
                    warnings.append(f"Table '{table}' exists in database but not in schema - run generate_schema.py")

            # Check for tables in schema but not in database
            for table in schema_tables:
                if table not in db_tables:
                    warnings.append(f"Table '{table}' exists in schema but not in database - may need to recreate database")

        except Exception as e:
            warnings.append(f"Could not compare schema with database: {e}")

    return errors, warnings


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 validate_dataset.py <path-to-dataset>")
        sys.exit(1)

    dataset_path = Path(sys.argv[1])

    errors, warnings = validate_dataset(dataset_path)

    print(f"Validating dataset: {dataset_path}")
    print("-" * 60)

    if errors:
        print(f"\n❌ Errors ({len(errors)}):")
        for error in errors:
            print(f"  - {error}")
    else:
        print("\n✅ No errors found")

    if warnings:
        print(f"\n⚠️  Warnings ({len(warnings)}):")
        for warning in warnings:
            print(f"  - {warning}")

    if errors:
        print(f"\n❌ Dataset is NOT valid - fix errors and re-run")
        sys.exit(1)
    else:
        print(f"\n✅ Dataset is valid")
        if warnings:
            print(f"   (Consider addressing warnings)")
        sys.exit(0)


if __name__ == "__main__":
    main()
