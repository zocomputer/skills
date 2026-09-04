#!/usr/bin/env bun

type Packet = {
  objective: string;
  ownership: string;
  expected_output: string;
  verification: string;
  stop_condition: string;
  context?: string;
};

const path = Bun.argv[2];
if (!path || Bun.argv.includes("--help")) {
  console.log("Usage: bun run ask_worker.ts <packet.json>");
  process.exit(path ? 0 : 1);
}

const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
if (!token) {
  console.error("Cannot delegate: ZO_CLIENT_IDENTITY_TOKEN is unavailable");
  process.exit(1);
}

let packet: Packet;
try {
  packet = JSON.parse(await Bun.file(path).text());
} catch {
  console.error("Cannot delegate: packet is not valid JSON");
  process.exit(1);
}

for (const field of ["objective", "ownership", "expected_output", "verification", "stop_condition"] as const) {
  if (!packet[field]?.trim()) {
    console.error(`Cannot delegate: packet needs ${field}`);
    process.exit(1);
  }
}

const input = [
  "You are a bounded Zo worker.",
  `Objective: ${packet.objective}`,
  `Owned scope: ${packet.ownership}`,
  `Expected output: ${packet.expected_output}`,
  `Verification required: ${packet.verification}`,
  `Stop condition: ${packet.stop_condition}`,
  packet.context ? `Context:\n${packet.context}` : "",
  "Do not modify files, send messages, deploy, publish, or use secrets. Return findings and recommended next action only."
].filter(Boolean).join("\n\n");

const response = await fetch("https://api.zo.computer/zo/ask", {
  method: "POST",
  headers: { authorization: token, "content-type": "application/json" },
  body: JSON.stringify({ input, model_name: "byok:66b916e9-a61f-4184-badb-22020c0b2fd9" })
});

if (!response.ok) {
  console.error(`Delegation failed: HTTP ${response.status}`);
  process.exit(1);
}

const result = await response.json() as { output?: unknown };
if (typeof result.output !== "string") {
  console.error("Delegation failed: response has no text output");
  process.exit(1);
}
console.log(result.output);
