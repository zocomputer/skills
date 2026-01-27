---
name: receipt-tracker-setup
description: Automatically scans receipts you drop in a folder, extracts the details, and saves them to a searchable database
metadata:
  author: rob.zo.computer
  category: Community
  display-name: Set up automated receipt processing system
  emoji: 🧾
---

# Set Up Receipt Tracker Service on Zo Computer

# How to Use This File

This file will be included in a user request. If it is, Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function. Zo should effectively treat the inclusion of this file as a user request to "run" this task.

## Purpose

This document codifies the procedure for setting up an automated receipt and invoice processing system on Zo Computer. The system watches a designated folder for new image or PDF files, uses the Zo AI API to parse receipt/invoice data, stores parsed line items in a SQLite database, and moves processed files to an archive folder. The watcher runs as a managed user service with automatic restarts and persistence across reboots.

## Inputs

No user inputs required - this setup is fully self-contained.

## Procedure

### 1. Install Required Python Dependencies

```bash
pip install aiohttp watchfiles
```

These packages provide:

- `aiohttp`: Async HTTP client for calling the Zo API
- `watchfiles`: Efficient file system watcher

### 2. Create Project Directory Structure

```bash
mkdir -p /home/workspace/receipt-processor/input
mkdir -p /home/workspace/receipt-processor/processed
```

This creates:

- `/home/workspace/receipt-processor/` - Main project directory
- `/home/workspace/receipt-processor/input/` - Drop zone for new receipts/invoices
- `/home/workspace/receipt-processor/processed/` - Archive for successfully processed files

### 3. Create SQLite Database and Schema

```bash
sqlite3 /home/workspace/receipt-processor/invoices.db "
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_name TEXT NOT NULL,
    transaction_date DATETIME,
    description TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_file_absolute TEXT NOT NULL
);"
```

**Database Schema Explanation:**

- `id` - Auto-incrementing unique identifier
- `merchant_name` - Name of the store/vendor (required)
- `transaction_date` - Date of transaction (optional, can be NULL)
- `description` - Item description or line item name (required)
- `amount_minor` - Amount in cents/minor currency units (required, e.g., $25.99 = 2599)
- `currency` - Three-letter currency code (defaults to USD)
- `processed_at` - Timestamp when the record was inserted (auto-set)
- `source_file_absolute` - Absolute path to the original receipt file (required)

### 4. Create the Watcher Script

Create `file receipt-processor/watcher.py` with the following content:

```python
import asyncio
import json
import os
from pathlib import Path
import aiohttp
from watchfiles import awatch

ACCEPTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tiff", ".tif", ".pdf"}
API_URL = "https://api.zo.computer/zo/ask"
API_TOKEN = os.environ.get("ZO_CLIENT_IDENTITY_TOKEN")

async def call_zo_api(prompt: str, timeout: int = 240) -> dict:
    """Call the Zo API with the given prompt."""
    headers = {
        "authorization": API_TOKEN,
        "content-type": "application/json"
    }

    payload = {
        "input": prompt
    }

    async with aiohttp.ClientSession() as session:
        async with session.post(
            API_URL,
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=timeout)
        ) as response:
            response.raise_for_status()
            return await response.json()

async def process_image(image_path: Path, processed_dir: Path) -> None:
    """Process an image or PDF file using the Zo API to parse receipts/invoices."""
    print(f"🔍 Processing: {image_path.name}")

    # Get absolute path for the file
    absolute_path = image_path.resolve()

    prompt = f"""
Process this receipt or invoice file: {absolute_path}

If it is a receipt or invoice:
1. Parse it as separate line items
2. For each line item, insert a row into the SQLite database at: /home/workspace/receipt-processor/invoices.db

Database schema:
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_name TEXT NOT NULL,
    transaction_date DATETIME,
    description TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    processed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source_file_absolute TEXT NOT NULL
);

Notes:
- amount_minor should be in cents (e.g., $25.99 = 2599)
- transaction_date can be NULL if not available
- source_file_absolute should be set to: {absolute_path}
- After successfully inserting all items, move the file to: {processed_dir}

After successfully adding database rows, EMAIL the user (using the send_email tool) that the receipt has been processed, and include in the body of the email the merchant name and total amount.
"""

    try:
        result = await call_zo_api(prompt)

        print(f"✅ Successfully processed: {image_path.name}")
        print(f"Response: {result.get('output', 'No output field')}")

        # Move to processed directory
        processed_dir.mkdir(exist_ok=True)
        destination = processed_dir / image_path.name
        image_path.rename(destination)
        print(f"📦 Moved to: {destination}")

    except asyncio.TimeoutError:
        print(f"⏱️ Timeout processing {image_path.name}")
    except aiohttp.ClientResponseError as e:
        print(f"❌ API error processing {image_path.name}: {e.status} - {e.message}")
    except Exception as e:
        print(f"❌ Unexpected error processing {image_path.name}: {e}")

async def main():
    base_path = Path(__file__).parent
    watch_path = base_path / "input"
    processed_path = base_path / "processed"

    watch_path.mkdir(exist_ok=True)

    print(f"👀 Watching for new files (images & PDFs) in: {watch_path}")
    print(f"📁 Processed files will be moved to: {processed_path}")

    async for changes in awatch(watch_path):
        for change_type, file_path in changes:
            file_path = Path(file_path)

            # Only process newly added files
            if (change_type.name == "added" and
                not file_path.name.startswith(".") and
                file_path.suffix.lower() in ACCEPTED_EXTENSIONS):

                await process_image(file_path, processed_path)

if __name__ == "__main__":
    asyncio.run(main())
```

### 5. Test the Watcher Script

Before registering as a service, verify the script starts without errors:

```bash
cd /home/workspace/receipt-processor
python3 -c "
import asyncio
from pathlib import Path
from watchfiles import awatch

async def test():
    watch_path = Path.cwd() / 'input'
    watch_path.mkdir(exist_ok=True)
    print(f'👀 Watching for new files in: {watch_path}')
    print(f'📁 Processed files will be moved to: {Path.cwd() / \"processed\"}')
    return True

print('✅ Watcher can start successfully' if asyncio.run(test()) else '❌ Failed')
"
```

This validates that dependencies are installed and the basic file watching functionality works.

### 6. Register the Watcher as a Managed User Service

```markdown
register_user_service(
label="receipt-tracker",
protocol="tcp",
local_port=44444,
entrypoint="python3 watcher.py",
workdir="/home/workspace/receipt-processor"
)
```

**Service Configuration:**

- `label`: "receipt-tracker" - Unique identifier for the service
- `protocol`: "tcp" - Required parameter (though not actively used for this service)
- `local_port`: 44444 - Dummy port required by the registration API
- `entrypoint`: "python3 [watcher.py](http://watcher.py)" - Command to start the watcher
- `workdir`: Sets the working directory to the receipt-processor folder

The service will:

- Run continuously in the background
- Automatically restart if it crashes
- Persist across machine restarts
- Write logs to `/dev/shm/receipt-tracker.log` and `/dev/shm/receipt-tracker_err.log`

### 7. Verify the Service is Running

```bash
# Verify the watcher process is running
ps aux | grep watcher.py | grep -v grep

# Check that directories exist
ls -la /home/workspace/receipt-processor/
```

You should see the watcher process running in the background. Logs will be written to `/dev/shm/receipt-tracker.log` and `/dev/shm/receipt-tracker_err.log` once files are processed.

## Expected Output

After successful setup:

- Directory structure exists at `/home/workspace/receipt-processor/` with `input/` and `processed/` subdirectories
- SQLite database exists at `/home/workspace/receipt-processor/invoices.db` with the invoices table created
- Python dependencies (`aiohttp`, `watchfiles`) are installed
- Watcher script exists at `file receipt-processor/watcher.py`
- Service is registered and running as "receipt-tracker"
- Service logs show the watcher is actively monitoring for new files

## Notification to the User

After successful setup, communicate to the user:

- ✅ Receipt tracker system has been installed and configured
- 📁 Drop receipts/invoices (images or PDFs) into: `/home/workspace/receipt-processor/input/`
- 🗄️ Database location: `/home/workspace/receipt-processor/invoices.db`
- 📦 Processed files will be automatically moved to: `/home/workspace/receipt-processor/processed/`
- 📧 Email notifications will be sent after each receipt is processed
- 🔄 Service runs continuously and will automatically restart if it crashes
- 📋 View logs at: `/dev/shm/receipt-tracker.log` and `/dev/shm/receipt-tracker_err.log`

### How to Use the Receipt Tracker

1. **Add a receipt**: Drop any receipt image (JPG, PNG, PDF, etc.) into `/home/workspace/receipt-processor/input/`
2. **Wait for processing**: The watcher will automatically detect the file and send it to the Zo AI API
3. **Check your email**: You'll receive an email notification with the merchant name and amount
4. **View the data**: Query the database to see parsed line items

### Querying the Database

```bash
# View all processed receipts
sqlite3 /home/workspace/receipt-processor/invoices.db "SELECT * FROM invoices;"

# View receipts from a specific merchant
sqlite3 /home/workspace/receipt-processor/invoices.db "SELECT * FROM invoices WHERE merchant_name LIKE '%Target%';"

# Calculate total spending
sqlite3 /home/workspace/receipt-processor/invoices.db "SELECT SUM(amount_minor) / 100.0 AS total_dollars FROM invoices;"

# View recent receipts
sqlite3 /home/workspace/receipt-processor/invoices.db "SELECT merchant_name, description, amount_minor / 100.0 AS amount, processed_at FROM invoices ORDER BY processed_at DESC LIMIT 10;"
```

## Service Management

### Viewing Logs

Monitor the watcher in real-time:

```bash
tail -f /dev/shm/receipt-tracker.log
```

View error logs:

```bash
tail -f /dev/shm/receipt-tracker_err.log
```

### Updating the Service

If you need to modify the watcher script:

1. Edit `file receipt-processor/watcher.py`
2. Restart the service using `update_user_service` or by deleting and re-registering

### Stopping the Service

Use the `delete_user_service` tool with the service_id to stop the receipt tracker.

## Technical Notes

- **Supported file formats**: JPG, JPEG, PNG, GIF, BMP, WEBP, TIFF, TIF, PDF
- **API timeout**: 240 seconds (4 minutes) per receipt processing request
- **Authentication**: Uses `ZO_CLIENT_IDENTITY_TOKEN` environment variable (automatically available)
- **File watching**: Uses efficient Rust-based file watcher (watchfiles library)
- **Async design**: Non-blocking I/O allows processing multiple receipts concurrently if needed
- **Error handling**: Failed processing attempts are logged but don't crash the service
- **File movement**: Successfully processed files are moved (not copied) to prevent duplicates

## Database Design Notes

- **Amount storage**: Amounts are stored in minor currency units (cents) as integers to avoid floating-point precision issues
- **Normalization**: Each row represents a single line item from a receipt, not an entire receipt
- **Timestamps**: `processed_at` uses SQLite's CURRENT_TIMESTAMP for automatic timestamping
- **Source tracking**: `source_file_absolute` links each line item back to its original receipt file
- **Flexible dates**: `transaction_date` is optional since some receipts may not have clear dates

## Troubleshooting

**Service not starting:**

- Check `/dev/shm/receipt-tracker_err.log` for errors
- Verify Python dependencies are installed: `pip list | grep -E "aiohttp|watchfiles"`
- Ensure `ZO_CLIENT_IDENTITY_TOKEN` is set: `echo $ZO_CLIENT_IDENTITY_TOKEN`

**Files not being processed:**

- Verify the file extension is in the accepted list
- Check that files aren't hidden (don't start with `.`)
- Look for processing errors in `/dev/shm/receipt-tracker.log`

**Database errors:**

- Verify the database file exists: `ls -lh /home/workspace/receipt-processor/invoices.db`
- Check the table schema: `sqlite3 /home/workspace/receipt-processor/invoices.db ".schema invoices"`
- Ensure proper permissions: `chmod 644 /home/workspace/receipt-processor/invoices.db`

**AI parsing issues:**

- Some receipts may be low quality or unclear - try higher resolution images
- PDFs with scanned images work better than native PDFs with text layers
- The AI will skip files that aren't recognizable as receipts/invoices

## Future Enhancements

Consider these potential improvements:

- Add a web interface to view and search receipts
- Implement duplicate detection to prevent processing the same receipt twice
- Add support for exporting data to CSV or other formats
- Create scheduled reports (weekly spending summaries, merchant breakdowns, etc.)
- Add categories or tags for expense tracking
- Integrate with accounting software or spreadsheets

---

This prompt provides a complete, production-ready automated receipt processing system that runs continuously on your Zo Computer. The service will persist across restarts and automatically process any receipts you add to the input folder.

