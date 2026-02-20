#!/usr/bin/env bun
/**
 * Detect MCP Server Authentication Requirements
 * Analyzes server endpoint to determine auth method
 */

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m";

interface AuthDetection {
  url: string;
  authType: "none" | "oauth" | "api-key" | "bearer" | "custom";
  details: string;
  suggestedSetup: string;
}

async function detectAuth(url: string): Promise<AuthDetection> {
  // Normalize URL
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  // Try to fetch server info
  try {
    // First try a simple GET to see if it responds
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json, text/event-stream",
      },
    });

    // Check response headers and status
    if (response.status === 401 || response.status === 403) {
      // Check for OAuth headers
      const wwwAuth = response.headers.get("WWW-Authenticate") || "";

      if (wwwAuth.toLowerCase().includes("bearer")) {
        return {
          url,
          authType: "bearer",
          details: "Server requires Bearer token authentication",
          suggestedSetup:
            "Store your API token as a secret (e.g., MY_API_TOKEN) and use: --header 'Authorization: Bearer ${MY_API_TOKEN}'",
        };
      }

      if (wwwAuth.toLowerCase().includes("oauth")) {
        return {
          url,
          authType: "oauth",
          details: "Server requires OAuth authentication",
          suggestedSetup: "Run: npx mcporter auth " + url,
        };
      }

      // Generic auth required
      return {
        url,
        authType: "api-key",
        details: "Server requires authentication (API key or token)",
        suggestedSetup:
          "Check server documentation for required headers. Common patterns:\n" +
          "  --header 'x-api-key: ${MY_API_KEY}' or\n" +
          "  --header 'Authorization: Bearer ${MY_API_KEY}'",
      };
    }

    // Check for SSE/streamable HTTP support
    const contentType = response.headers.get("Content-Type") || "";

    if (response.ok && contentType.includes("application/json")) {
      // Try to get server info
      const text = await response.text();
      if (text.includes("server") || text.includes("mcp") || text.includes("protocol")) {
        return {
          url,
          authType: "none",
          details: "Server appears to be publicly accessible",
          suggestedSetup:
            "Run: npx mcporter config add <name> " + url + " --scope home",
        };
      }
    }

    if (response.ok && contentType.includes("text/event-stream")) {
      return {
        url,
        authType: "none",
        details: "Server supports SSE transport",
        suggestedSetup:
          "Run: npx mcporter config add <name> " + url + " --scope home",
      };
    }

    // Try POST to initialize MCP connection
    const initResponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mcporter-setup", version: "1.0.0" },
        },
      }),
    });

    if (initResponse.status === 401 || initResponse.status === 403) {
      return {
        url,
        authType: "api-key",
        details: "Server requires authentication for MCP operations",
        suggestedSetup:
          "Check server documentation for authentication requirements",
      };
    }

    if (initResponse.ok) {
      const data = await initResponse.json();
      if (data.result) {
        return {
          url,
          authType: "none",
          details:
            "Server responds to MCP protocol without authentication",
          suggestedSetup:
            "Run: npx mcporter config add <name> " + url + " --scope home",
        };
      }
    }

    return {
      url,
      authType: "custom",
      details:
        "Could not determine auth method. Server may require custom setup.",
      suggestedSetup:
        "Check server documentation or try: npx mcporter auth " + url,
    };
  } catch (error) {
    return {
      url,
      authType: "custom",
      details: `Error connecting to server: ${error}`,
      suggestedSetup:
        "Verify the URL is correct and the server is accessible",
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const url = args[0];

  if (!url) {
    console.log("Usage: bun detect-auth.ts <server_url>");
    console.log("Example: bun detect-auth.ts https://mcp.example.com/mcp");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║     MCP Auth Detection                 ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log(`${BLUE}Analyzing: ${url}${NC}\n`);

  const result = await detectAuth(url);

  console.log(`${GREEN}Auth Type: ${result.authType.toUpperCase()}${NC}`);
  console.log(`Details: ${result.details}\n`);
  console.log(`${YELLOW}Suggested Setup:${NC}`);
  console.log(result.suggestedSetup);

  // Output JSON for programmatic use
  console.log("\n---JSON---");
  console.log(JSON.stringify(result, null, 2));
}

main();
