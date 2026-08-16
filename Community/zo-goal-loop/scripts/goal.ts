import { $ } from "bun";

const GOAL_FILE = "/tmp/current-goal.txt";
const PROGRESS_FILE = "/tmp/zo-goal-progress.log";

async function main() {
  const args = Bun.argv.slice(2);
  
  // Check for help flag
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`Zo Goal Loop - Work until condition met

Usage: bun run goal.ts "<completion condition>" [options]

Options:
  --max-turns=N      Stop after N turns (default: 100)
  --save-to=file.md   Save progress log to workspace file

Examples:
  bun run goal.ts "All tests pass"
  bun run goal.ts "Find 3 solutions" --max-turns=20 --save-to=solutions.md

Force stop: rm /tmp/current-goal.txt
`);
    process.exit(0);
  }

  const condition = args[0];
  let maxTurns = 100;
  let saveToFile: string | null = null;

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--max-turns=")) {
      maxTurns = parseInt(arg.split("=")[1]);
    }
    if (arg.startsWith("--save-to=")) {
      saveToFile = arg.split("=")[1];
    }
  }

  console.log(`Goal: ${condition}`);
  console.log(`Max turns: ${maxTurns}\n`);

  // Write goal to file for tracking
  await Bun.write(GOAL_FILE, condition);
  await Bun.write(PROGRESS_FILE, `Goal started: ${new Date().toISOString()}\nCondition: ${condition}\n\n`);

  const ZO_API_KEY = Bun.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!ZO_API_KEY) {
    console.error("Error: ZO_CLIENT_IDENTITY_TOKEN not found in environment");
    process.exit(1);
  }

  const MODEL = "byok:ee9b6e08-3859-4d08-91ec-bfc683010ef4";
  const API_URL = "https://api.zo.computer/zo/ask";

  let turn = 0;
  let completed = false;

  while (turn < maxTurns && !completed) {
    turn++;
    console.log(`\n=== Turn ${turn} ===`);

    // Call Zo API with the goal
    const prompt = `Working toward goal: "${condition}"
Current turn: ${turn}
Previous output/log: See progress file at ${PROGRESS_FILE}

What is the next action to take toward achieving this goal? Be specific and runnable. 
If the goal appears already achieved, respond with "GOAL_ACHIEVED" and a summary.`;

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

      // Write progress
      await Bun.write(PROGRESS_FILE, `${output}\n\n`, { append: true });

      // Check if goal achieved
      if (output.includes("GOAL_ACHIEVED")) {
        completed = true;
        console.log("\n✓ Goal achieved!");
        if (saveToFile) {
          await copyToWorkspace(saveToFile);
        }
        break;
      }

      // Check if goal file was removed (force stop)
      if (!(await fileExists(GOAL_FILE))) {
        console.log("\n✗ Goal interrupted by user");
        process.exit(0);
      }
    } catch (err) {
      console.error("API error:", err);
      process.exit(1);
    }
  }

  if (!completed) {
    console.log(`\nStopped after ${maxTurns} turns`);
  }

  await Bun.write(GOAL_FILE, `COMPLETED: ${completed ? "yes" : "no"} at turn ${turn}`);
}

async function fileExists(path: string) {
  try {
    await Bun.file(path).text();
    return true;
  } catch {
    return false;
  }
}

async function copyToWorkspace(dest: string) {
  const content = await Bun.file(PROGRESS_FILE).text();
  await Bun.write(`/home/workspace/${dest}`, content);
}

main();