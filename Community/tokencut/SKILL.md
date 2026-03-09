---
name: tokencut
description: Compress text using AgentReady's TokenCut API to reduce token usage by 40-60% with minimal accuracy loss. Use when you need to reduce prompt length or compress text before sending to LLMs.
category: Data & Integrations
metadata:
  author: YOUR_HANDLE.zo.computer
  emojis: ["✂️", "📉", "⚡"]
tags:
  - compression
  - token-optimization
  - ai-costs
  - agentready
---

# TokenCut - Text Compression Skill

This skill compresses text using AgentReady's TokenCut API to reduce token usage by 40-60% with minimal accuracy loss (~0.4% on standard benchmarks).

---

## ⚠️ CRITICAL: When TokenCut Works vs. Doesn't Work

### ✅ TokenCut WORKS (Saves Tokens)

| Scenario | Why It Works |
|----------|--------------|
| **Script calling external LLM** | Script fetches data → compresses → sends to OpenAI/Claude API. The LLM only sees compressed text. |
| **zo.space API routes** | Route receives request → compresses → calls LLM. The LLM only sees compressed text. |
| **Multi-agent pipeline with file handoff** | Agent A compresses → writes to file → Agent B reads compressed file. Agent B sees less content. |
| **Pre-processing data for later** | Compress now, store. Future LLM calls use compressed data. |

**The key:** The LLM that processes the data must see the COMPRESSED version, not the original.

### ❌ TokenCut DOESN'T WORK (No Savings)

| Scenario | Why It Fails |
|----------|--------------|
| **Single agent fetching and processing** | Agent reads data into its context (tokens consumed), then compresses. Too late. |
| **Agent calling TokenCut on its own fetched data** | The agent already "saw" the uncompressed data. |
| **Compression after LLM processing** | Tokens already consumed. |

**The problem:** If an LLM agent fetches data via API, it immediately reads that data into its context. Compressing afterward doesn't undo the token usage.

---

## Architecture Comparison

### ❌ Wrong Way (Single Agent)

```
┌─────────────────────────────────────────────────────────────────┐
│                   SCHEDULED AGENT (GLM 5)                       │
│                                                                 │
│  Step 1: "Fetch emails from Gmail"                              │
│          └── API returns 500 emails                             │
│          └── Agent READS them ← 🔴 TOKENS CONSUMED HERE         │
│                                                                 │
│  Step 2: "Compress with TokenCut"                               │
│          └── Returns compressed text                            │
│          └── Agent READS result ← 🔴 MORE TOKENS                │
│                                                                 │
│  Step 3: "Summarize and send digest"                            │
│          └── No savings possible - already consumed tokens      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### ✅ Right Way (Script + External LLM)

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCRIPT (No LLM context)                      │
│                                                                 │
│  Step 1: Fetch emails from Gmail API                            │
│          └── Returns raw data (no token cost - just API call)   │
│                                                                 │
│  Step 2: Compress with TokenCut                                 │
│          └── Returns compressed text                            │
│                                                                 │
│  Step 3: Send to EXTERNAL LLM (OpenAI, Claude, etc.)            │
│          └── 🟢 LLM only sees COMPRESSED text                   │
│          └── 🟢 Token savings: 40-60%                           │
│                                                                 │
│  Step 4: Save result to file                                    │
│          └── Agent reads tiny summary (minimal tokens)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- AgentReady API key saved in Zo Secrets as `AGENTREADY_API_KEY`

---

## Usage

### Option 1: In Scripts (Recommended for Token Savings)

Use TokenCut in scripts that call external LLMs:

```typescript
import { compressText } from "/home/workspace/Skills/tokencut/scripts/compress.ts";

// Fetch data (no LLM yet)
const rawData = await fetchDataFromAPI();

// Compress BEFORE sending to LLM
const compressed = await compressText(rawData, "standard");

// Send to external LLM (only sees compressed version)
const response = await fetch("https://api.openai.com/v1/chat/completions", {
  body: JSON.stringify({
    model: "gpt-4o",
    messages: [{ role: "user", content: compressed }],
  }),
});
```

### Option 2: Direct Script Usage

Run the compression script directly:

```bash
bun /home/workspace/Skills/tokencut/scripts/compress.ts --text "your long text here" --level standard
```

**Arguments:**
- `--text` or `-t`: The text to compress (required)
- `--level`: Compression level - `light`, `standard` (default), or `aggressive`
- `--output` or `-o`: Optional output file path

**Examples:**
```bash
# Standard compression (recommended)
bun /home/workspace/Skills/tokencut/scripts/compress.ts --text "your prompt here" --level standard

# Light compression (preserves more, saves 20-30%)
bun /home/workspace/Skills/tokencut/scripts/compress.ts -t "your text" -l light

# Aggressive compression (maximum savings, ~60%)
bun /home/workspace/Skills/tokencut/scripts/compress.ts -t "your text" -l aggressive -o result.txt
```

### Option 3: REST API Direct

Call the AgentReady API directly:

```bash
curl -X POST https://agentready.cloud/v1/compress \
  -H "Authorization: Bearer $AGENTREADY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "your text to compress", "level": "standard"}'
```

---

## Compression Levels

| Level | Token Savings | Best For |
|-------|---------------|----------|
| Light | 20-30% | Code, math, technical content |
| Standard | 40-50% | General prompts, web content (recommended) |
| Aggressive | 55-60% | Long documents, articles |

---

## Integration Patterns

### Pattern 1: Script-Based Workflow (Best for Scheduled Tasks)

Instead of having an agent do everything, use a script:

```yaml
# Agent instruction
Run the script `bun /home/workspace/Scripts/your-batch-script.ts --output /tmp/result.md`
Then read the output file and send a summary via Telegram.
```

**Why this works:** The script handles the heavy processing (fetch + compress + LLM call), the agent only sees a tiny summary.

### Pattern 2: zo.space API Route

Create an API route that compresses before calling an LLM:

```typescript
// /api/compress-and-process route
import { compressText } from "/home/workspace/Skills/tokencut/scripts/compress.ts";

export default async (c) => {
  const { text } = await c.req.json();
  
  // Compress first
  const compressed = await compressText(text, "standard");
  
  // Then process with LLM (only sees compressed)
  const result = await callLLM(compressed);
  
  return c.json({ result });
};
```

### Pattern 3: Multi-Agent Pipeline with File Handoff

```
Agent A (Fetcher):
1. Fetch data from API
2. Compress with TokenCut
3. Write to file: /tmp/compressed_data.txt

Agent B (Processor):
1. Read file: /tmp/compressed_data.txt
2. Process the compressed data
3. Output final result
```

**Note:** Agent B saves tokens because it reads the compressed file. Agent A still consumes tokens reading the original data, but its job is minimal (just fetch and compress).

---

## What's New (Feb 2026)

AgentReady launched a **privacy-first API**:

- **`/v1/compress` endpoint** - Now live and stable
- **Your LLM key never leaves your environment** - No `X-Upstream-API-Key` needed
- **Optimized compression** - More efficient token reduction
- **Token usage tracking** - Better visibility into savings
- **Self-hosted version** - Coming soon for entirely local compression

---

## Tips

- **Best for**: Web content, articles, documentation, long prompts
- **Preserves**: Code blocks, URLs, numbers, proper nouns
- **Avoid for**: Code (use light), math equations, very short prompts (<100 tokens)

---

## When to Trigger This Skill

### Automatic Trigger (Recommended)

This skill should be **automatically triggered** whenever you are about to write, create, or modify a script that processes multiple items through an LLM in a batch/loop pattern. You do NOT need to explicitly call this skill for these cases. The auto-trigger fires for:

- Mass classification of items via scripted LLM calls
- Bulk labeling or categorization through a dataset
- Row-by-row CSV/JSON processing sent to an external LLM API
- Batch summarization of multiple documents
- Bulk content generation pipelines
- Parallel LLM calls over a dataset
- Any script that iterates over data and sends each item to OpenAI, Claude, Gemini, or similar

**What the auto-trigger does:** Imports `compressText` from this skill's `compress.ts` and compresses the data payload before each LLM call in the script. System prompts and short inputs are left uncompressed.

**Tip:** To enable auto-triggering on Zo, create a conditional rule that fires when writing batch LLM scripts, with instructions to import and use the `compressText` function from this skill.

### Manual Trigger

This skill should also be triggered when:
- You need to compress text in a script before calling an external LLM
- You're building a multi-agent pipeline with file handoffs
- You're creating a zo.space API route that processes text
- You need to pre-process data for later LLM consumption

### When NOT to Trigger

This skill should NOT be triggered when:
- A single agent is fetching and processing data in one go (tokens already consumed in context)
- The LLM has already consumed the tokens
- You're just trying to reduce an agent's output size
- The input is very short (<100 tokens / ~400 chars)
- The input is structured data (JSON schemas, configs) where exact format matters
- The input is executable code (compress docs ABOUT code, not the code itself)