#!/usr/bin/env bun

type Node = {
  id: string;
  purpose: string;
  dependencies: string[];
  ownership: string;
  expected_output: string;
  verification: string;
  stop_condition: string;
  risk: "low" | "medium" | "high";
  agent: string;
  command?: string;
  repository?: string;
};

type Graph = { objective: string; success_criteria: string[]; nodes: Node[] };

function fail(message: string): never {
  console.error(`Cannot orchestrate: ${message}`);
  process.exit(1);
}

const graphPath = Bun.argv[2];
if (!graphPath || Bun.argv.includes("--help")) {
  console.log("Usage: bun run orchestrate.ts <graph.json> [--json] [--execute] [--delegate-zo] [--keep-worktrees]");
  console.log("Defaults to a dependency-ordered dry-run. --execute runs explicit node commands in temporary Git worktrees.");
  process.exit(graphPath ? 0 : 1);
}

const execute = Bun.argv.includes("--execute");
const delegateZo = Bun.argv.includes("--delegate-zo");
const keepWorktrees = Bun.argv.includes("--keep-worktrees");

let graph: Graph;
try {
  graph = JSON.parse(await Bun.file(graphPath).text());
} catch {
  fail("graph is not valid JSON");
}

if (!graph.objective?.trim() || !Array.isArray(graph.success_criteria) || !graph.success_criteria.length) fail("objective and success_criteria are required");
if (!Array.isArray(graph.nodes) || !graph.nodes.length) fail("nodes are required");

const byId = new Map<string, Node>();
for (const node of graph.nodes) {
  if (!node.id?.trim() || byId.has(node.id)) fail("node ids must be unique and non-empty");
  if (!Array.isArray(node.dependencies)) fail(`${node.id} dependencies must be an array`);
  byId.set(node.id, node);
}

for (const node of graph.nodes) {
  for (const dependency of node.dependencies) if (!byId.has(dependency)) fail(`${node.id} references missing dependency: ${dependency}`);
}

const visiting = new Set<string>();
const visited = new Set<string>();
const ordered: Node[] = [];
function visit(id: string) {
  if (visiting.has(id)) fail(`dependency cycle includes ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of byId.get(id)!.dependencies) visit(dependency);
  visiting.delete(id);
  visited.add(id);
  ordered.push(byId.get(id)!);
}
for (const node of graph.nodes) visit(node.id);

const report = {
  objective: graph.objective,
  status: "planned",
  dispatch_mode: execute ? "worktree-command" : "external",
  nodes: ordered.map((node, index) => ({
    order: index + 1,
    id: node.id,
    agent: node.agent,
    risk: node.risk,
    dependencies: node.dependencies,
    ownership: node.ownership,
    verification: node.verification,
    stop_condition: node.stop_condition
  }))
};

if (execute) {
  const { $ } = await import("bun");
  for (const node of ordered) {
    if (!node.command) {
      console.log(`Skipped ${node.id}: no command`);
      continue;
    }
    if (!node.repository) fail(`${node.id} needs repository for --execute`);
    const status = await $`git -C ${node.repository} status --porcelain`.text();
    if (status.trim()) fail(`repository has dirty changes: ${node.repository}`);
    const branch = `zo/task-${node.id}-${Date.now()}`;
    const worktree = `/tmp/${branch}`;
    await $`git -C ${node.repository} worktree add -b ${branch} ${worktree} HEAD`.quiet();
    try {
      console.log(`Running ${node.id} in ${worktree}`);
      await $`sh -c ${node.command}`.cwd(worktree);
      console.log(`Verified command completed: ${node.id}`);
    } finally {
      if (!keepWorktrees) await $`git -C ${node.repository} worktree remove --force ${worktree}`.quiet();
    }
  }
}

if (delegateZo) {
  const { $ } = await import("bun");
  for (const node of ordered.filter((candidate) => candidate.agent === "zo")) {
    const packetPath = `/tmp/zo-packet-${node.id}-${Date.now()}.json`;
    await Bun.write(packetPath, JSON.stringify({
      objective: node.purpose,
      ownership: node.ownership,
      expected_output: node.expected_output,
      verification: node.verification,
      stop_condition: node.stop_condition,
      context: `Parent objective: ${graph.objective}\nSuccess criteria: ${graph.success_criteria.join("; ")}`
    }));
    try {
      console.log(`Delegating ${node.id} to Zo`);
      await $`bun run ${import.meta.dir}/ask_worker.ts ${packetPath}`;
    } finally {
      await Bun.file(packetPath).delete();
    }
  }
}

if (Bun.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
else {
  console.log(`Execution plan: ${ordered.length} node(s)`);
  for (const node of report.nodes) console.log(`${node.order}. ${node.id} [${node.agent}, ${node.risk}]`);
  console.log(execute ? "Dispatch mode: worktree-command." : "Dispatch mode: external; no worker was started.");
}
