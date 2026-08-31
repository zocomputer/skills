#!/usr/bin/env bun

interface CompressResponse {
  success: boolean;
  data?: {
    original_length: number;
    compressed_length: number;
    savings_percent: number;
    compressed_text: string;
  };
  error?: string;
}

const API_URL = "https://agentready.cloud/v1/compress";

async function getApiKey(): Promise<string> {
  const apiKey = process.env.AGENTREADY_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AGENTREADY_API_KEY not found in environment. Please add it to Zo Secrets."
    );
  }
  return apiKey;
}

export async function compressText(
  text: string,
  level: "light" | "standard" | "aggressive" = "standard"
): Promise<string> {
  const apiKey = await getApiKey();

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, level }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Compression failed: ${response.status} ${error}`);
  }

  const result: CompressResponse = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error || "Compression failed");
  }

  return result.data.compressed_text;
}

async function main() {
  const args = process.argv.slice(2);
  let text = "";
  let level: "light" | "standard" | "aggressive" = "standard";
  let outputFile = "";

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--text" || arg === "-t") {
      text = args[++i];
    } else if (arg === "--level" || arg === "-l") {
      const lvl = args[++i].toLowerCase();
      if (["light", "standard", "aggressive"].includes(lvl)) {
        level = lvl as "light" | "standard" | "aggressive";
      }
    } else if (arg === "--output" || arg === "-o") {
      outputFile = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      console.log(`
TokenCut - Text Compression CLI

Usage: bun compress.ts [options]

Options:
  -t, --text <text>     Text to compress (required)
  -l, --level <level>  Compression level: light, standard, aggressive (default: standard)
  -o, --output <file>  Output file path (optional)
  -h, --help           Show this help message

Examples:
  bun compress.ts -t "your text here"
  bun compress.ts --text "your text" --level aggressive
  bun compress.ts -t "your text" -o compressed.txt
`);
      process.exit(0);
    }
  }

  if (!text) {
    console.error("Error: --text or -t is required");
    console.log("Run with --help for usage information");
    process.exit(1);
  }

  console.log(`Compressing text (${text.length} chars) with ${level} level...`);

  try {
    const compressed = await compressText(text, level);

    if (outputFile) {
      await Bun.write(outputFile, compressed);
      console.log(`Compressed text saved to: ${outputFile}`);
    } else {
      console.log("\n--- Compressed Text ---\n");
      console.log(compressed);
    }

    const savings = ((1 - compressed.length / text.length) * 100).toFixed(1);
    console.log(`\nOriginal: ${text.length} chars | Compressed: ${compressed.length} chars | Savings: ${savings}%`);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
