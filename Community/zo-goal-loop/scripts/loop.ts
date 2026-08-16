import { $ } from "bun";

async function main() {
  const args = Bun.argv.slice(2);
  
  // Check for help flag
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`Zo Loop - Run prompt repeatedly

Usage: bun run loop.ts "<prompt>" [options]

Options:
  --interval=ms        Wait between iterations (default: 5000)
  --max-iterations=N   Stop after N iterations (default: unlimited)
  --until="<cond>"     Stop when condition met
  
Until condition formats:
  file:/path         Stop when file exists
  match:pattern      Stop when output contains pattern
  cmd:"command"      Stop when command exits 0

Examples:
  bun run loop.ts "Check status" --interval=30000
  bun run loop.ts "Monitor logs" --until="match:ERROR" --max-iterations=10

Force stop: rm /tmp/zo-loop-running
`);
    process.exit(0);
  }

  const prompt = args[0];
  let interval = 5000;
  let maxIterations = -1;
  let untilCondition: string | null = null;

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--interval=")) {
      interval = parseInt(arg.split("=")[1]);
    }
    if (arg.startsWith("--max-iterations=")) {
      maxIterations = parseInt(arg.split("=")[1]);
    }
    if (arg.startsWith("--until=")) {
      untilCondition = arg.split("=")[1];
    }
  }

  console.log(`Loop prompt: ${prompt}`);
  console.log(`Interval: ${interval}ms`);
  console.log(`Max iterations: ${maxIterations < 0 ? "unlimited" : maxIterations}`);
  if (untilCondition) console.log(`Until condition: ${untilCondition}`);

  // Create marker file for interruption
  await Bun.write("/tmp/zo-loop-running", "true");

  const ZO_API_KEY = Bun.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!ZO_API_KEY) {
    console.error("Error: ZO_CLIENT_IDENTITY_TOKEN not found");
    process.exit(1);
  }

  const MODEL = "byok:ee9b6e08-3859-4d08-91ec-bfc683010ef4";
  const API_URL = "https://api.zo.computer/zo/ask";

  let iteration = 0;
  let done = false;

  while (!done) {
    if (maxIterations > 0 && iteration >= maxIterations) break;
    iteration++;

    console.log(`\n=== Iteration ${iteration} ===`);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "authorization": ZO_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: prompt,
          model_name: MODEL,
        }),
      });

      const result = await res.json();
      const output = result.output || "";
      console.log(output);

      // Check until condition
      if (untilCondition) {
        const conditionMet = await checkCondition(untilCondition, output);
        if (conditionMet) {
          done = true;
          console.log("\n✓ Until condition met!");
          break;
        }
      }

      // Check if loop file was removed (force stop)
      if (!(await fileExists("/tmp/zo-loop-running"))) {
        console.log("\n✗ Loop interrupted by user");
        break;
      }
    } catch (err) {
      console.error("API error:", err);
      process.exit(1);
    }

    await sleep(interval);
  }

  await Bun.write("/tmp/loop-iterations.txt", `Total: ${iteration}`);
}

async function checkCondition(condition: string, output: string): Promise<boolean> {
  // Simple file exists check
  if (condition.startsWith("file:")) {
    const file = condition.slice(5);
    return await fileExists(file);
  }
  // Output match
  if (condition.startsWith("match:")) {
    const pattern = condition.slice(6);
    return output.toLowerCase().includes(pattern.toLowerCase());
  }
  // Command success
  if (condition.startsWith("cmd:")) {
    const cmd = condition.slice(4);
    const proc = Bun.spawn(["bash", "-c", cmd]);
    const exitCode = await proc.exited;
    return exitCode === 0;
  }
  return false;
}

async function fileExists(path: string) {
  try {
    await Bun.file(path).text();
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();