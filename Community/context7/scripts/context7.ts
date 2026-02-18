#!/usr/bin/env bun

const API_BASE = "https://api.context7.com";
const API_KEY = process.env.CONTEXT7_API_KEY || "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};
if (API_KEY) {
  headers["X-Context7-Api-Key"] = API_KEY;
}

async function resolveLibrary(query: string): Promise<any[]> {
  const url = `${API_BASE}/v1/search?query=${encodeURIComponent(query)}&limit=5`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Search failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.results || data;
}

async function getDocs(
  libraryId: string,
  query: string,
  tokens: number = 10000
): Promise<string> {
  const url = `${API_BASE}/v1/docs?libraryId=${encodeURIComponent(libraryId)}&query=${encodeURIComponent(query)}&tokens=${tokens}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Docs fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function resolveViaMcp(libraryName: string, query: string): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "resolve-library-id",
      arguments: { libraryName, query },
    },
  };
  const res = await fetch("https://mcp.context7.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(API_KEY ? { CONTEXT7_API_KEY: API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP resolve failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return parseSSE(await res.text());
  }
  return res.json();
}

async function queryDocsViaMcp(
  libraryId: string,
  query: string,
  tokens: number = 10000
): Promise<any> {
  const body = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "query-docs",
      arguments: { libraryId, query, tokens },
    },
  };
  const res = await fetch("https://mcp.context7.com/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(API_KEY ? { CONTEXT7_API_KEY: API_KEY } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MCP query-docs failed: ${res.status} ${text}`);
  }
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/event-stream")) {
    return parseSSE(await res.text());
  }
  return res.json();
}

function parseSSE(raw: string): any {
  const lines = raw.split("\n");
  let lastData = "";
  for (const line of lines) {
    if (line.startsWith("data: ")) {
      lastData = line.slice(6);
    }
  }
  if (lastData) {
    try {
      return JSON.parse(lastData);
    } catch {
      return lastData;
    }
  }
  return raw;
}

function extractText(mcpResult: any): string {
  if (!mcpResult) return "";
  const result = mcpResult.result || mcpResult;
  if (result.content && Array.isArray(result.content)) {
    return result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");
  }
  if (typeof result === "string") return result;
  return JSON.stringify(result, null, 2);
}

const usage = `
context7 - Fetch up-to-date library documentation via Context7

Usage:
  bun context7.ts search <library-name>          Search for a library by name
  bun context7.ts docs <library-id> <query>      Get docs for a specific library
  bun context7.ts lookup <library-name> <query>   Search + fetch docs in one step
  bun context7.ts --help                          Show this help

Options:
  --tokens <n>    Max tokens for docs (default: 10000)
  --api-key <key> Override CONTEXT7_API_KEY env var

Examples:
  bun context7.ts search "next.js"
  bun context7.ts docs /vercel/next.js "app router middleware"
  bun context7.ts lookup "hono" "routing and middleware" --tokens 8000
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help")) {
    console.log(usage.trim());
    process.exit(0);
  }

  let tokensArg = 10000;
  const tokensIdx = args.indexOf("--tokens");
  if (tokensIdx !== -1 && args[tokensIdx + 1]) {
    tokensArg = parseInt(args[tokensIdx + 1], 10);
    args.splice(tokensIdx, 2);
  }

  const apiKeyIdx = args.indexOf("--api-key");
  if (apiKeyIdx !== -1 && args[apiKeyIdx + 1]) {
    headers["X-Context7-Api-Key"] = args[apiKeyIdx + 1];
    args.splice(apiKeyIdx, 2);
  }

  const command = args[0];

  if (command === "search") {
    const name = args.slice(1).join(" ");
    if (!name) {
      console.error("Error: library name required");
      process.exit(1);
    }
    console.log(`Searching for: ${name}`);
    const result = await resolveViaMcp(name, name);
    const text = extractText(result);
    console.log(text || JSON.stringify(result, null, 2));
  } else if (command === "docs") {
    const libId = args[1];
    const query = args.slice(2).join(" ");
    if (!libId || !query) {
      console.error("Error: library-id and query required");
      process.exit(1);
    }
    console.log(`Fetching docs for ${libId}: "${query}"`);
    const result = await queryDocsViaMcp(libId, query, tokensArg);
    const text = extractText(result);
    console.log(text || JSON.stringify(result, null, 2));
  } else if (command === "lookup") {
    const name = args[1];
    const query = args.slice(2).join(" ");
    if (!name || !query) {
      console.error("Error: library-name and query required");
      process.exit(1);
    }
    console.log(`Resolving library: ${name}`);
    const searchResult = await resolveViaMcp(name, query);
    const searchText = extractText(searchResult);

    const idMatch = searchText.match(/Context7-compatible library ID:\s*(\S+)/);
    if (!idMatch) {
      console.log("Search results:");
      console.log(searchText);
      console.error("\nCould not auto-extract library ID. Use 'docs' command with a specific ID.");
      process.exit(1);
    }

    const libraryId = idMatch[1];
    console.log(`Found library ID: ${libraryId}`);
    console.log(`\nFetching docs for: "${query}"`);
    const docsResult = await queryDocsViaMcp(libraryId, query, tokensArg);
    const docsText = extractText(docsResult);
    console.log(docsText || JSON.stringify(docsResult, null, 2));
  } else {
    console.error(`Unknown command: ${command}`);
    console.log(usage.trim());
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
