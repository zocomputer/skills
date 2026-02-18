#!/usr/bin/env python3
"""
Create a new Zo Dataset scaffold.

Usage:
    python3 create_dataset.py <dataset-name>

Creates a dataset directory with all required files in Datasets/<dataset-name>/.
"""

import argparse
import json
from pathlib import Path


def create_dataset(name: str, workspace: Path = Path("/home/workspace/Datasets")):
    """Create a new dataset scaffold."""

    dataset_dir = workspace / name

    if dataset_dir.exists():
        print(f"Error: {dataset_dir} already exists.")
        return

    # Create directories
    dataset_dir.mkdir(parents=True)
    (dataset_dir / "ingest").mkdir()
    (dataset_dir / "source").mkdir()
    (dataset_dir / "assets").mkdir()

    # Create datapackage.json
    datapackage = {
        "name": name,
        "title": name.replace("-", " ").title(),
        "description": f"Zo dataset for {name}",
        "version": "1.0.0",
        "resources": [
            {
                "path": "data.duckdb",
            }
        ],
    }

    with open(dataset_dir / "datapackage.json", "w") as f:
        json.dump(datapackage, f, indent=2)

    # Create schema.yaml (empty - will be generated after database creation)
    with open(dataset_dir / "schema.yaml", "w") as f:
        f.write("tables: []\n")

    # Copy generate_schema.py
    script_dir = Path(__file__).parent
    shutil = __import__("shutil")
    shutil.copy(script_dir / "generate_schema.py", dataset_dir / "generate_schema.py")

    # Create README.md template
    readme = f"""# {name.replace("-", " ").title()}

This is a Zo dataset.

## What's inside

- `data.duckdb` – DuckDB database with your data
- `schema.yaml` – Schema for the table so you can inspect it quickly
- `datapackage.json` – Dataset metadata

## Getting started

1. Add your source files to `source/`
2. Create and populate `data.duckdb` with your data
3. Run `python3 generate_schema.py` to generate the schema
4. View in Zo UI at /?t=datasets

## Documentation

See PROCESS.md for ingestion instructions.
"""

    with open(dataset_dir / "README.md", "w") as f:
        f.write(readme)

    # Create PROCESS.md template
    process_md = """# Process for Ingesting Data

1. Place source files in `source/`
2. Run the ingestion script (e.g., `python ingest/ingest.py`)
3. Generate schema: `python3 generate_schema.py`
4. View in Zo UI at /?t=datasets

## Ingestion Script

Create `ingest/ingest.py` to:
- Read source files from `source/`
- Transform and clean data
- Write to `data.duckdb`
- Log any errors or warnings

## Notes

- This dataset is designed for idempotence: rerunning the script should handle updates gracefully
- Use scheduled agents (see [Scheduled Tasks](/?t=agents)) for automatic updates
"""

    with open(dataset_dir / "PROCESS.md", "w") as f:
        f.write(process_md)

    print(f"Created dataset scaffold at: {dataset_dir}")
    print(f"Next steps:")
    print(f"  1. Add source files to {dataset_dir / 'source'}/")
    print(f"  2. Create data.duckdb with your data")
    print(f"  3. Run: cd {dataset_dir} && python3 generate_schema.py")


def main():
    parser = argparse.ArgumentParser(description="Create a new Zo Dataset scaffold")
    parser.add_argument("name", help="Dataset name (lowercase, hyphens only)")

    args = parser.parse_args()

    # Validate name
    if not args.name.islower() or " " in args.name:
        print("Error: Dataset name must be lowercase with hyphens only (e.g., 'my-dataset')")
        return

    create_dataset(args.name)


if __name__ == "__main__":
    main()
