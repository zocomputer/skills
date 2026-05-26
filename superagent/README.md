# Superagent — Zo Computer Skill

Delegate tasks to your Superagent on Base44. Sends POST requests to your Base44 endpoint and relays responses back.

## Quick Start

```bash
git clone https://github.com/AKHtun/superagent.git
cd superagent

# Set your endpoint
export SUPERAGENT_BASE44_URL="https://<your-superagent>.base44.app/functions/zoMessage"

# Python
python3 scripts/superagent.py --message "Hello from Zo"

# TypeScript/Bun
bun run scripts/superagent.ts --message "Hello from Zo"
```

## Usage

| Option | Flag | Description |
|--------|------|-------------|
| Message | `--message` / `-m` | The task or message to send |
| Conversation ID | `--conversation_id` / `-c` | Continue an existing thread |
| File input | `--file` | Read message from a file path |
| Raw JSON output | `--raw` | Output raw JSON instead of just the reply |
| Stdin | (no flag) | Pipe message via stdin |

## Requirements

- Python 3.x **or** Bun
- A Base44 Superagent endpoint
- `SUPERAGENT_BASE44_URL` environment variable set

## License

MIT — see SKILL.md for full details.
