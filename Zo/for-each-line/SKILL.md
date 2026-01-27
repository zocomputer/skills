---
name: Process file line-by-line with script
description: Processes every line of a file one by one, transforming or extracting information from each line
metadata:
  author: Zo
  emoji: 🔄
---

Process files line-by-line using `zo` to transform or extract data from each line.

#### Notes on zo

`zo` is a command-line program that gives Zo access to Zo itself, with all the same prompts, tools, and power. It's located at `/usr/local/bin/zo`.

```bash
➜  ~ zo -h
usage: zo [-h] [--output-format OUTPUT_FORMAT] input

Call Zo AI with optional structured output

positional arguments:
  input                 Input text to send to Zo

options:
  -h, --help            show this help message and exit
  --output-format OUTPUT_FORMAT
                        JSON schema for structured output (optional)

Examples:
  zo "hello"
  zo "what's 2+2?" --output-format '{"type": "object", "properties": {"answer": {"type": "number"}}, "required": ["answer"]}'

output_format uses OpenAI's structured output JSON schema format.
Keep schemas flat (max 1-2 levels) for best results.
```

# Protocol

## Step 1: Ask clarifying questions

Do NOT assume. Ask the user:

- What should be extracted/transformed from each line?
- What format should the output be?
- What happens if a line fails - halt everything or continue?

## Step 2: Create the processing script

Create a script in the conversation workspace.

Requirements:

- Flat schemas: Keep `output_format` max 1-2 levels deep
- Never swallow errors: Use `check=True`, no try/except hiding failures
- Sequential processing: Each line waits for the previous (70s timeout per line)
- Include context necessary to the task in every call: Each zo call is independent
- Incremental writes: Flush after each line so partial results are saved if script crashes

**Use this template** and customize the `process_line` function based on user requirements:

```python
#!/usr/bin/env python3
import subprocess
import json
import sys
from pathlib import Path
from typing import List, Dict, Any

def parse_file_lines(filepath: Path) -> List[str]:
    """Split file into lines, keeping newlines. Must satisfy: ''.join(lines) == original."""
    with open(filepath, 'r') as f:
        content = f.read()
    lines = content.splitlines(keepends=True)
    return lines

def call_zo(prompt: str, output_format: Dict[str, Any] = None) -> Any:
    """Call zo with the given prompt. Errors bubble up for visibility."""
    cmd = ["zo", prompt]
    if output_format:
        cmd.extend(["--output-format", json.dumps(output_format)])

    result = subprocess.run(
        cmd, capture_output=True, text=True, check=True, timeout=70
    )
    response = json.loads(result.stdout)
    return response["output"]

def process_line(line: str, instruction: str) -> str:
    """Process a single line. Customize based on user requirements."""
    # Keep output_format flat (max 1-2 levels)
    output_format = {
        "type": "object",
        "properties": {
            "result": {"type": "string", "description": "the processed result"}
        },
        "required": ["result"]
    }

    # Include all context in each call (calls are independent)
    prompt = f"{instruction}\n\nInput: {line.strip()}"
    output = call_zo(prompt, output_format)
    return output["result"]

def process_file(input_path: Path, output_path: Path, instruction: str) -> None:
    """Process each line sequentially, writing results incrementally."""
    lines = parse_file_lines(input_path)

    if not lines:
        print("No lines to process")
        return

    with open(output_path, 'w') as f:
        for i, line in enumerate(lines, 1):
            print(f"Processing line {i}/{len(lines)}...", file=sys.stderr)
            result = process_line(line, instruction)
            f.write(result + '\n')
            f.flush()  # Write immediately for crash recovery

    print(f"\nComplete! Output written to {output_path}")

def main():
    if len(sys.argv) < 3:
        print("Usage: ./script.py <input_file> <output_file> [instruction]")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    instruction = sys.argv[3] if len(sys.argv) > 3 else "process this line"

    if not input_path.exists():
        print(f"Error: Input file {input_path} does not exist", file=sys.stderr)
        sys.exit(1)

    process_file(input_path, output_path, instruction)

if __name__ == "__main__":
    main()
```

## Step 3: Test with the first line and get confirmation

Before running the batch script, test by calling `zo` directly on the first line:

1. Read the first line from the file
2. Construct a test prompt matching what the script will use: `{instruction}\n\nInput: {first_line_content}`
3. Call `zo` via Bash with the same output format the script will use
4. Show the user the test result
5. **Ask the user**: "Does this result look correct? Should I proceed with processing all lines?"
6. Wait for user confirmation before continuing

If the user is not satisfied, ask what needs to be adjusted and refine the approach. You may need to revise the instruction, output format, or processing logic.

**Example test command:**

```bash
zo "Extract the email address.\n\nInput: John Doe <john@example.com>" \
  --output-format '{"type": "object", "properties": {"result": {"type": "string"}}, "required": ["result"]}'
```

## Step 4: Create the output file

You must use `tool create_or_rewrite_file` to create an empty output file. This allows the user to open it in their editor and watch results stream in. You must never use touch to create the output file.

## Step 5: Run the full batch

Execute the script via Bash to process all lines:

```bash
python3 process_script.py input.txt output.txt "instruction"
```

The script writes results incrementally to the output file.

# Output

Inform the user when processing is complete. Show:

- Total lines processed
- Location of output file
- Any errors encountered

