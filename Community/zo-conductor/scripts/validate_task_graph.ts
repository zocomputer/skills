#!/usr/bin/env bun

type Node = {
  id?: string;
  purpose?: string;
  dependencies?: string[];
  ownership?: string;
  expected_output?: string;
  verification?: string;
  stop_condition?: string;
  risk?: string;
  agent?: string;
};

function fail(message: string): never {
  console.error(`Invalid task graph: ${message}`);
  process.exit(1);
}

const path = Bun.argv[2];
if (!path) fail("provide a JSON file path");

let graph: { objective?: string; success_criteria?: string[]; nodes?: Node[] };
try {
  graph = JSON.parse(await Bun.file(path).text());
} catch {
  fail("file is not valid JSON");
}

if (!graph.objective?.trim()) fail("objective is required");
if (!Array.isArray(graph.success_criteria) || graph.success_criteria.length === 0) fail("success_criteria must be non-empty");
if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) fail("nodes must be non-empty");

const ids = new Set<string>();
for (const node of graph.nodes) {
  if (!node.id?.trim()) fail("every node needs an id");
  if (ids.has(node.id)) fail(`duplicate node id: ${node.id}`);
  ids.add(node.id);
  for (const field of ["purpose", "ownership", "expected_output", "verification", "stop_condition", "agent"] as const) {
    if (!node[field]?.trim()) fail(`${node.id} needs ${field}`);
  }
  if (!Array.isArray(node.dependencies)) fail(`${node.id} dependencies must be an array`);
  if (!["low", "medium", "high"].includes(node.risk ?? "")) fail(`${node.id} has invalid risk`);
  for (const dependency of node.dependencies) if (!ids.has(dependency) && !graph.nodes.some((candidate) => candidate.id === dependency)) fail(`${node.id} references missing dependency: ${dependency}`);
}

const visiting = new Set<string>();
const visited = new Set<string>();
const byId = new Map(graph.nodes.map((node) => [node.id!, node]));
function visit(id: string): void {
  if (visiting.has(id)) fail(`dependency cycle includes ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency);
  visiting.delete(id);
  visited.add(id);
}
for (const node of graph.nodes) visit(node.id!);

console.log(`Valid task graph: ${graph.nodes.length} node(s), ${visited.size} reachable node(s)`);
