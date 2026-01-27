---
name: Enrich CSV with AI-generated columns
description: Adds new columns to your spreadsheet by generating information for each row
metadata:
  author: Zo
  category: Official
  emoji: 📊
---

# Enrich CSV with AI-Generated Columns

## How to Use This Prompt

This prompt is called with two parameters:

1. **Enrichment directive** (required): Description of the new column to add (e.g., "estimated GDP 2025", "population in millions", "capital city")
2. **Filter** (optional): Description of which rows to process (e.g., "European countries only", "countries with population > 50M")

When this prompt is invoked, Zo will:

1. Read a handful of rows from the CSV to understand the current schema
2. Generate a Python script tailored to your specific CSV and enrichment request
3. The script will prepare the CSV by adding any new columns before processing begins
4. Execute the script to process the CSV in batches, making sub-API requests to get structured output for each row
5. The Python script will write the enriched data back to the CSV immediately as each API call completes (not in one big transaction at the end)
6. The user's enrichment directive may be either very simple or very detailed, specifying specific tools to use etc. When translating their ask from a chat into the script, you are free to reword their initial query for clarity and completeness into the API prompt, but never omit any special requests that they included in their original ask. Your job is to write the best possible prompt into the script for the API request to fulfill the user's original intent with quality and accuracy. Each API request will only process one row at a time and will as a Zo sub-agent to return the requested data, after using any of the tools and capabilities that Zo has access to on this host. You can include specific instructions in the prompt to guide the API on how to get the data, if needed.

**Example usage:**

- "Enrich this CSV with 'estimated GDP 2025'"
- "Enrich this CSV with 'official language' for European countries only"
- "Add a column for 'capital city population' filtering to Asian countries"

## How to Invoke This Prompt

To use this prompt, open a CSV file in your workspace and invoke it in chat:

1. **Simple enrichment (no filter):**
   - Type `/` in chat to see available prompts
   - Select "enrich-csv" or type `prompt Prompts/enrich-csv.prompt.md`
   - Follow with your directive: "Add a 'capital city' column"

2. **Enrichment with filter:**
   - Reference the prompt: `prompt Prompts/enrich-csv.prompt.md`
   - Include both directive and filter: "Add 'official language' for European countries only"

3. **Direct invocation:**
   - While viewing a CSV file, simply say: "Enrich this with \[directive\]"
   - Zo will automatically use this prompt to process your request

**Complete examples:**

```markdown
prompt 'Prompts/enrich-csv.prompt.md' - add estimated GDP 2025 to this CSV
```

```markdown
Enrich csvs/countries.csv with 'continent' column
```

```markdown
Add 'population in millions' for countries with GDP > 1 trillion
```

## Procedure

### 1. Analyze the Target CSV

Read the CSV file that the user wants to enrich to understand its structure, column names, and sample data.

### 2. Understand the CSV Schema

Read the first 3-5 rows of the CSV to understand its structure and determine what data should be passed as INPUT to the API (e.g., country name, identifier columns) versus what should be requested as OUTPUT (the new enrichment data).

### 3. Generate the Enrichment Script

Create a Python script in the current conversation's workspace directory in /home/.z/workspaces/<conv_id>/enrich<my_descriptive_name>.py with a file derived from the following template, tailoring the actual script for the specific request. The following is an example, but is very close to the kind of script to generate:

```python
import asyncio
import csv
import os
from pathlib import Path
import httpx

# This entire file is an example script demonstrating how to enrich a CSV file
# It is intended to be fully adapted to a particular use case by changing all the configuration
# and deviating from the logic and structure as needed by the situation.
# The script is idempotent: it will only add columns if they don't exist, and only process
# rows that don't already have values in the target columns. This allows safe re-runs.

# Configuration
CSV_PATH = "/home/workspace/csvs/countries.csv"  # Will be set to actual CSV path
NEW_COLUMN_NAMES = ["estimated_gdp_2025"]  # List of new columns to add (based on enrichment directive)
ENRICHMENT_DIRECTIVE = "Add estimated GDP for 2025 in billions USD"  # The user's request. This is a short example, but in reality be specific and detailed.
INPUT_COLUMNS = ["name", "country_code"]  # Which existing columns to pass to the API as input
ROW_FILTER = None  # Optional: e.g., "European countries only, or only countries that start with 'A'"
BATCH_SIZE = 8  # Number of rows to process concurrently

API_URL = "https://api.zo.computer/zo/ask"
API_TOKEN = os.environ.get("ZO_CLIENT_IDENTITY_TOKEN")

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "estimated_gdp_2025": {"type": "string"}
    },
    "required": ["estimated_gdp_2025"]
}


async def call_zo_api(prompt: str, output_format: dict, timeout: int = 120) -> dict:
    """Call the Zo API with structured output and return the parsed response."""
    headers = {"authorization": API_TOKEN, "content-type": "application/json"}

    payload = {
        "input": prompt,
        "output_format": output_format,
        "model_name": "grok-code-fast-1"
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()
        result = response.json()
        return result.get("output", {})


def update_csv_row(csv_path: Path, row_index: int, new_values: dict):
    """Update a specific row in the CSV file with new values."""
    rows = []
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    rows[row_index].update(new_values)

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


async def enrich_row(row: dict, row_index: int, csv_path: Path) -> dict:
    """Enrich a single row with the new column data."""
    input_data = {k: row[k] for k in INPUT_COLUMNS if k in row}
    row_description = ", ".join([f"{k}: {v}" for k, v in input_data.items()])

    filter_instruction = ""
    if ROW_FILTER:
        filter_instruction = f"""
IMPORTANT: This enrichment should only apply to rows matching: {ROW_FILTER}
If this row does NOT match the filter criteria, set all output fields to "SKIP".
"""

    prompt = f"""You are enriching a CSV file. Process ONLY this single row.

Row data: {row_description}

Task: {ENRICHMENT_DIRECTIVE}
{filter_instruction}

Return ONLY the requested new data. Do NOT include the existing row data in your response.
If you cannot determine a value, use "N/A" for that field.
"""

    try:
        identifier = row.get(INPUT_COLUMNS[0], 'unknown') if INPUT_COLUMNS else 'unknown'
        print(f"  Processing row {row_index + 1}: {identifier}")
        result = await call_zo_api(prompt, OUTPUT_SCHEMA)

        print(f"    ↳ RESULT: {result}")

        if result.get(NEW_COLUMN_NAMES[0]) != "SKIP":
            update_csv_row(csv_path, row_index, result)
        else:
            print(f"    ↳ Skipped (filtered out)")

        return {**row, **result}
    except Exception as e:
        print(f"    ↳ Error: {e}")
        error_values = {col: "ERROR" for col in NEW_COLUMN_NAMES}
        update_csv_row(csv_path, row_index, error_values)
        return {**row, **error_values}


async def main():
    csv_path = Path(CSV_PATH)

    print(f"📄 Reading CSV: {csv_path}")
    with open(csv_path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        original_fieldnames = list(reader.fieldnames)

    print(f"📊 Found {len(rows)} rows total")
    print(f"🎯 Enrichment: {ENRICHMENT_DIRECTIVE}")

    if ROW_FILTER:
        print(f"🔍 Filter: {ROW_FILTER}")
    print(f"⚙️  Batch size: {BATCH_SIZE} rows at a time\n")

    # If we can filter rows programmatically based on a column, add that logic here, otherwise rely on the LLM to skip rows.

    columns_to_add = [col for col in NEW_COLUMN_NAMES if col not in original_fieldnames]
    if columns_to_add:
        print(f"🔧 Preparing CSV by adding new columns: {', '.join(columns_to_add)}")
        new_fieldnames = original_fieldnames + columns_to_add

        for row in rows:
            for col in columns_to_add:
                row[col] = ""

        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=new_fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        print(f"✓ CSV prepared with new columns\n")
    else:
        print(f"✓ All columns already exist in CSV\n")

    rows_to_process = [
        (i, row) for i, row in enumerate(rows)
        if not all(row.get(col, "").strip() for col in NEW_COLUMN_NAMES)
    ]

    print(f"📋 {len(rows_to_process)} rows need processing ({len(rows) - len(rows_to_process)} already enriched)\n")

    for batch_num, i in enumerate(range(0, len(rows_to_process), BATCH_SIZE)):
        batch_items = rows_to_process[i:i + BATCH_SIZE]
        batch = [row for _, row in batch_items]
        indices = [idx for idx, _ in batch_items]

        print(f"🔄 Processing batch {batch_num + 1} ({len(batch)} rows)...")
        tasks = [enrich_row(row, idx, csv_path) for idx, row in zip(indices, batch)]
        await asyncio.gather(*tasks)
        print()

    print(f"✅ Enrichment complete! {len(rows_to_process)} rows processed")


if __name__ == "__main__":
    asyncio.run(main())
```

### 4. Customize the Script

Based on the user's request and the CSV schema, update these variables in the generated script:

- `CSV_PATH`: Absolute path to the CSV file being enriched
- `NEW_COLUMN_NAMES`: List of new column names to add (sanitized, use underscores, lowercase)
- `ENRICHMENT_DIRECTIVE`: The user's description of what to add
- `INPUT_COLUMNS`: Which existing CSV columns to pass as input to the API (e.g., identifiers, names)
- `ROW_FILTER`: The user's filter description (or `None` if no filter specified)
- `OUTPUT_SCHEMA`: JSON schema defining the structure of the expected output (only new fields, not existing data)

The user may ask for any kind of enrichment, so adapt the script dynamically as needed. They may ask for example for multiple new columns, or to clean up an existing column, etc. All of those specifications should be encoded in an appropriate output schema and enrichment directive that will be passed to the API for each row. The better the prompt given to the API, the better the results, so explaining oneself clearly in the prompt is important.

### 5. Install Dependencies

Ensure required packages are installed:

```bash
pip install httpx
```

### 6. Execute the Script

Run the enrichment script:

```bash
python3 /home/.z/workspaces/<conversation_id>/my-csv-enrichment-script.py
```

### 7. Verify Output

After execution:

- Check that the CSV was modified in place with the new column(s)
- Verify the new column was added with appropriate values
- Confirm that filtering worked correctly (if a filter was specified)

## Expected Output

- The original CSV file is modified in place with the new column(s) added
- The new column(s) added as the rightmost column(s) in the CSV
- All original columns and data preserved
- Rows that don't match the filter (if specified) will remain empty in the new column (not written to)
- Console output showing progress as each row is processed and written back to the file
- CSV is updated incrementally as each API call completes (not in one batch at the end)
- Script can be safely re-run: it will only process rows that are missing values in the target columns

## Technical Notes

- **Idempotent design**: The script can be safely re-run multiple times
  - Only adds columns if they don't already exist
  - Automatically skips rows that already have values in the target columns
  - Useful for resuming interrupted enrichments or adding more rows to a CSV
- **Structured output**: Uses JSON schema to request only new data fields, not existing row data
- **Batch processing**: Processes up to 8 rows concurrently (configurable via `BATCH_SIZE`)
- **Row-level prompts**: Each row is processed individually with its own AI request
- **Incremental writes**: The Python script opens and writes to the CSV immediately after each API call completes
- **Column preparation**: New columns are added to the CSV before any processing begins
- **Input selection**: Only relevant columns are passed as INPUT to the API (configured via `INPUT_COLUMNS`)
- **Filter handling**:
  - If filter can be applied in pure Python, add logic to filter the set before processing via the API
  - Otherwise, include filter criteria in the prompt and instruct AI to return "SKIP" for non-matching rows
- **Error handling**: Rows that error during processing get "ERROR" as the value
- **Authentication**: Uses `ZO_CLIENT_IDENTITY_TOKEN` environment variable already set in env
- **Output format**: Modifies the original file in place; CSV formatting is preserved

## Troubleshooting

**Script fails to start:**

- Check that `httpx` is installed: `pip list | grep httpx`
- Verify `ZO_CLIENT_IDENTITY_TOKEN` is set: `echo $ZO_CLIENT_IDENTITY_TOKEN`

**Poor enrichment quality:**

- Make the enrichment directive more specific
- Provide examples in the directive (e.g., "GDP in billions USD, e.g., 1234.5")
- Reduce batch size if timeout errors occur

**Filter not working:**

- Make filter criteria more explicit
- Check if filter requires domain knowledge the AI might not have
- Consider pre-filtering with Python if criteria are deterministic

**Timeout errors:**

- Increase the `timeout` parameter in `call_zo_api`
- Reduce `BATCH_SIZE` to process fewer rows concurrently
- Simplify the enrichment directive

---

This prompt provides a flexible, reusable approach to enriching any CSV file with AI-generated data, with intelligent filtering and efficient batch processing.

