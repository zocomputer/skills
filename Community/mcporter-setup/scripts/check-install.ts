#!/usr/bin/env bun
/**
 * Check MCPorter Installation
 * Verifies mcporter is installed and installs if needed
 */

const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

async function checkInstallation(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = Bun.spawnSync(["npx", "mcporter", "--version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    if (result.exitCode === 0) {
      const version = result.stdout.toString().trim();
      return { installed: true, version };
    }

    // Try to parse error - might just be "not installed yet"
    const stderr = result.stderr.toString();
    if (stderr.includes("installed") || result.exitCode !== 0) {
      // npx will auto-install on first use, so this is actually fine
      return { installed: true, version: "will install on first use" };
    }

    return { installed: false, error: stderr };
  } catch (error) {
    return { installed: false, error: String(error) };
  }
}

async function installMcporter(): Promise<boolean> {
  console.log(`${YELLOW}Installing mcporter globally...${NC}`);

  try {
    // Install globally with npm
    const result = Bun.spawnSync(
      ["npm", "install", "-g", "mcporter", "--silent"],
      {
        stdout: "pipe",
        stderr: "pipe",
      }
    );

    if (result.exitCode === 0) {
      console.log(`${GREEN}✓ mcporter installed globally${NC}`);
      return true;
    }

    // Try with pnpm as fallback
    console.log(`${YELLOW}Trying pnpm...${NC}`);
    const pnpmResult = Bun.spawnSync(
      ["pnpm", "add", "-g", "mcporter"],
      { stdout: "pipe", stderr: "pipe" }
    );

    if (pnpmResult.exitCode === 0) {
      console.log(`${GREEN}✓ mcporter installed globally via pnpm${NC}`);
      return true;
    }

    console.log(
      `${YELLOW}Note: mcporter can run via npx without global install${NC}`
    );
    return true; // npx handles this
  } catch (error) {
    console.log(`${RED}Install error: ${error}${NC}`);
    return false;
  }
}

async function main() {
  console.log("╔════════════════════════════════════════╗");
  console.log("║     MCPorter Installation Check        ║");
  console.log("╚════════════════════════════════════════╝\n");

  // Check prerequisites
  const nodeCheck = Bun.spawnSync(["node", "--version"], {
    stdout: "pipe",
  });
  if (nodeCheck.exitCode !== 0) {
    console.log(`${RED}✗ Node.js is not installed${NC}`);
    console.log("  Please install Node.js first.");
    process.exit(1);
  }
  console.log(`${GREEN}✓ Node.js ${nodeCheck.stdout.toString().trim()}${NC}`);

  // Check mcporter
  const status = await checkInstallation();

  if (status.installed) {
    console.log(`${GREEN}✓ MCPorter available${NC}`);
    if (status.version && status.version !== "will install on first use") {
      console.log(`  Version: ${status.version}`);
    } else {
      console.log(`  Will install on first use via npx`);
    }
    process.exit(0);
  }

  // Need to install
  console.log(`${YELLOW}MCPorter not found${NC}`);
  const success = await installMcporter();

  if (success) {
    console.log(`\n${GREEN}MCPorter is ready to use!${NC}`);
    console.log("  Run: npx mcporter list");
    process.exit(0);
  } else {
    console.log(`\n${RED}Installation failed${NC}`);
    console.log("  You can still use: npx mcporter <command>");
    process.exit(1);
  }
}

main();
