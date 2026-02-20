#!/usr/bin/env bun
/**
 * Test MCP Server Connection
 * Verifies server connectivity and lists available tools
 */

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const BLUE = "\x1b[34m";
const NC = "\x1b[0m";

interface TestResult {
  serverName: string;
  status: "success" | "error" | "auth-required" | "timeout";
  toolCount?: number;
  tools?: Array<{ name: string; description: string }>;
  latency?: number;
  error?: string;
}

async function testServer(serverName: string): Promise<TestResult> {
  const startTime = Date.now();

  try {
    // Run mcporter list with JSON output
    const result = Bun.spawnSync(
      ["npx", "mcporter", "list", serverName, "--json"],
      {
        stdout: "pipe",
        stderr: "pipe",
        timeout: 60000,
      }
    );

    const latency = Date.now() - startTime;

    if (result.exitCode !== 0) {
      const stderr = result.stderr.toString();

      if (
        stderr.includes("401") ||
        stderr.includes("403") ||
        stderr.includes("Authentication required")
      ) {
        return {
          serverName,
          status: "auth-required",
          latency,
          error: "Authentication required. Check your API key or run: npx mcporter auth " + serverName,
        };
      }

      if (stderr.includes("timeout") || stderr.includes("timed out")) {
        return {
          serverName,
          status: "timeout",
          latency,
          error: "Connection timed out. Server may be offline or unreachable.",
        };
      }

      return {
        serverName,
        status: "error",
        latency,
        error: stderr || "Unknown error",
      };
    }

    // Parse JSON output
    const output = result.stdout.toString();
    const data = JSON.parse(output);

    // Extract tool info
    const tools = (data.tools || []).map(
      (t: { name: string; description?: string }) => ({
        name: t.name,
        description: t.description || "No description",
      })
    );

    return {
      serverName,
      status: "success",
      toolCount: tools.length,
      tools,
      latency,
    };
  } catch (error) {
    return {
      serverName,
      status: "error",
      latency: Date.now() - startTime,
      error: String(error),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const serverName = args[0];

  if (!serverName) {
    console.log("Usage: bun test-server.ts <server_name>");
    console.log("Example: bun test-server.ts linear");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║     MCP Server Connection Test         ║");
  console.log("╚════════════════════════════════════════╝\n");

  console.log(`${BLUE}Testing: ${serverName}${NC}\n`);

  const result = await testServer(serverName);

  // Display results
  switch (result.status) {
    case "success":
      console.log(`${GREEN}✓ Connection successful${NC}`);
      console.log(`  Tools available: ${result.toolCount}`);
      console.log(`  Latency: ${result.latency}ms\n`);

      if (result.tools && result.tools.length > 0) {
        console.log(`${YELLOW}Available Tools:${NC}`);
        result.tools.forEach((tool) => {
          console.log(`  • ${tool.name}`);
          if (tool.description) {
            console.log(`    ${tool.description.slice(0, 60)}${tool.description.length > 60 ? "..." : ""}`);
          }
        });

        console.log(`\n${GREEN}To use a tool:${NC}`);
        console.log(`  npx mcporter call ${serverName}.${result.tools[0].name}`);
        console.log(`\n${GREEN}To see all parameters:${NC}`);
        console.log(`  npx mcporter list ${serverName} --all-parameters`);
      }
      break;

    case "auth-required":
      console.log(`${RED}✗ Authentication required${NC}`);
      console.log(`  ${result.error}\n`);
      console.log(`${YELLOW}To fix:${NC}`);
      console.log("  1. Check your API key is set in Zo Secrets");
      console.log("  2. Or run: npx mcporter auth " + serverName);
      break;

    case "timeout":
      console.log(`${RED}✗ Connection timed out${NC}`);
      console.log(`  ${result.error}\n`);
      console.log(`${YELLOW}Possible causes:${NC}`);
      console.log("  • Server is offline");
      console.log("  • Network connectivity issues");
      console.log("  • Server URL is incorrect");
      break;

    case "error":
      console.log(`${RED}✗ Connection failed${NC}`);
      console.log(`  Error: ${result.error}\n`);
      console.log(`${YELLOW}Troubleshooting:${NC}`);
      console.log("  • Verify the server URL in your config");
      console.log("  • Check if authentication is required");
      console.log("  • Try: npx mcporter list --verbose");
      break;
  }

  // Output JSON for programmatic use
  console.log("\n---JSON---");
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.status === "success" ? 0 : 1);
}

main();
