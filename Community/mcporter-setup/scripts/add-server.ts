#!/usr/bin/env bun
/**
 * Add MCP Server Configuration
 * Handles server setup with proper authentication
 */

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

interface ServerConfig {
  name: string;
  url: string;
  description?: string;
  authType: "none" | "oauth" | "api-key" | "bearer" | "custom";
  headerName?: string;
  secretVar?: string;
  scope: "home" | "project";
}

function parseArgs(): ServerConfig | null {
  const args = process.argv.slice(2);
  const config: Partial<ServerConfig> = {
    scope: "home",
    authType: "none",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--name":
        config.name = args[++i];
        break;
      case "--url":
        config.url = args[++i];
        break;
      case "--description":
        config.description = args[++i];
        break;
      case "--auth-type":
        config.authType = args[++i] as ServerConfig["authType"];
        break;
      case "--header-name":
        config.headerName = args[++i];
        break;
      case "--secret-var":
        config.secretVar = args[++i];
        break;
      case "--scope":
        config.scope = args[++i] as "home" | "project";
        break;
      case "--help":
        console.log(`
Add MCP Server Configuration

Usage: bun add-server.ts [options]

Options:
  --name <name>           Server name (required)
  --url <url>             Server URL (required)
  --description <desc>    Server description
  --auth-type <type>      Auth type: none, oauth, api-key, bearer, custom
  --header-name <name>    Header name for API key (e.g., "x-api-key")
  --secret-var <var>      Environment variable name for secret
  --scope <scope>         Config scope: home (default) or project
  --help                  Show this help
`);
        process.exit(0);
    }
  }

  if (!config.name || !config.url) {
    console.log(`${RED}Error: --name and --url are required${NC}`);
    return null;
  }

  return config as ServerConfig;
}

async function addServer(config: ServerConfig): Promise<boolean> {
  const args = ["mcporter", "config", "add", config.name, config.url];

  // Add description
  if (config.description) {
    args.push("--description", config.description);
  }

  // Add auth header if needed
  if (config.authType === "api-key" || config.authType === "bearer") {
    if (config.headerName && config.secretVar) {
      const headerValue =
        config.authType === "bearer"
          ? `Bearer \${${config.secretVar}}`
          : `\${${config.secretVar}}`;
      args.push("--header", `${config.headerName}: ${headerValue}`);
    } else {
      console.log(
        `${YELLOW}Warning: API key auth requires --header-name and --secret-var${NC}`
      );
    }
  }

  args.push("--scope", config.scope);

  console.log(`${YELLOW}Adding server configuration...${NC}`);
  console.log(`  Name: ${config.name}`);
  console.log(`  URL: ${config.url}`);
  if (config.description) console.log(`  Description: ${config.description}`);
  if (config.secretVar)
    console.log(`  Secret: ${config.secretVar} (from Zo Secrets)`);
  console.log("");

  const result = Bun.spawnSync(["npx", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode === 0) {
    console.log(`${GREEN}✓ Server '${config.name}' added successfully${NC}`);

    if (config.secretVar) {
      console.log(
        `\n${YELLOW}Important: Make sure '${config.secretVar}' is set in Zo Secrets${NC}`
      );
      console.log("  Go to: Settings > Advanced > Secrets\n");
    }

    return true;
  }

  console.log(`${RED}Failed to add server${NC}`);
  console.log(result.stderr.toString());
  return false;
}

async function main() {
  const config = parseArgs();

  if (!config) {
    console.log("\nRun with --help for usage information");
    process.exit(1);
  }

  console.log("╔════════════════════════════════════════╗");
  console.log("║     Add MCP Server Configuration       ║");
  console.log("╚════════════════════════════════════════╝\n");

  const success = await addServer(config);

  if (success) {
    console.log(`\n${GREEN}Next steps:${NC}`);
    console.log(`  Test connection: npx mcporter list ${config.name}`);
    console.log(`  View tools: npx mcporter list ${config.name} --all-parameters`);
  }

  process.exit(success ? 0 : 1);
}

main();
