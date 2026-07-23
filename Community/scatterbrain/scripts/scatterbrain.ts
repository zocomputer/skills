#!/usr/bin/env bun
// Scatterbrain engine. Scatter N isolated Zo child sessions across cognitive
// frames, then hyperfocus: one critic pass scores/clusters/flags traps, and
// the top survivors get deepened. Branch isolation is mechanical: each frame
// runs in its own /zo/ask session and never sees another branch's output.
//
// Method lineage: rebuilt for Zo from the divergent-ideation loop in
// UditAkhourii/adhd (MIT). All prose, frames, and code here are original.

type Frame = { id: string; label: string; vantage: string; tags: string[] };

const FRAMES: Frame[] = [
  {
    id: "night-dispatcher",
    label: "night dispatcher",
    vantage:
      "You run a freight dispatch desk at 2am. Everything is routes, delays, driver hours, and rerouting around a closed mountain pass. Redraw this problem as loads that have to move tonight. What gets batched, what gets rerouted, what waits for morning?",
    tags: ["build", "shape"],
  },
  {
    id: "salvage-mechanic",
    label: "salvage mechanic",
    vantage:
      "You build machines from what is already in the yard. Buying new parts is cheating. What existing pieces, half-dead tools, and leftover scraps bolt together into a working version of this?",
    tags: ["build", "open"],
  },
  {
    id: "first-timer",
    label: "first-time user, no manual",
    vantage:
      "You have never seen this product category and nobody handed you a manual. What would you try first, what would you expect to just work, and where would you get stuck? Naive moves only. Convention is invisible to you.",
    tags: ["open", "feral"],
  },
  {
    id: "saboteur",
    label: "paid saboteur",
    vantage:
      "Someone is paying you to make the obvious solution fail quietly, months from now. List the ways you would sabotage it. Then flip each sabotage into a design idea that survives you.",
    tags: ["build", "shape"],
  },
  {
    id: "coroner",
    label: "project coroner",
    vantage:
      "It is two years later and this project is dead. You are writing the cause-of-death report. Name the plausible causes, then turn each cause into an idea that would have prevented it.",
    tags: ["shape", "open"],
  },
  {
    id: "street-vendor",
    label: "street vendor",
    vantage:
      "You sell out of a cart. Cash box, weather, foot traffic, no permits you can't afford. What is the cart version of this: the crudest thing that still does the one load-bearing job, today, with what's on hand?",
    tags: ["build", "open"],
  },
  {
    id: "skunkworks",
    label: "billionaire skunkworks",
    vantage:
      "Money and headcount are noise. You have ten years, no competitors, and no one asking for progress reports. What is the maximal version of this? What would you build if shipping small was illegal?",
    tags: ["shape", "feral"],
  },
  {
    id: "mycologist",
    label: "mycologist",
    vantage:
      "Think in mycelium: decentralized, redundant, slow, and nearly unkillable, trading nutrients through a network with no center. Force the fungal version of this problem. What routes around damage on its own?",
    tags: ["build", "feral"],
  },
  {
    id: "tower-controller",
    label: "air traffic controller",
    vantage:
      "Everything is flows, separation minimums, holding patterns, and handoffs between sectors. Redraw the problem as airspace. What needs separation, what circles in a hold, what gets handed off and to whom?",
    tags: ["build", "shape"],
  },
  {
    id: "lockpicker",
    label: "lockpicker",
    vantage:
      "You find the path the designer never intended. No breaking, only abusing the rules as written: side doors, default states, sequence breaks, things that are technically allowed. What is the abusive-but-legal route through this?",
    tags: ["build", "feral"],
  },
  {
    id: "inversion",
    label: "inversion",
    vantage:
      "Ask the opposite question. If the goal is X, brainstorm how to guarantee not-X: how to make this fail, drive people away, waste the budget. Then negate each answer back into a real idea.",
    tags: ["build", "shape", "open"],
  },
  {
    id: "assumption-thief",
    label: "assumption thief",
    vantage:
      "Name the one thing everyone in this problem treats as fixed: the tool, the schedule, the data model, the fact that a human is in the loop. Steal it. It is gone. What becomes possible without it?",
    tags: ["build", "shape", "feral"],
  },
  {
    id: "inheritor",
    label: "the stranger who inherits this",
    vantage:
      "Five years from now a stranger owns this with no docs and no one to ask. Design so that stranger sleeps at night. What ideas make the system explain itself, fail loudly, and stay fixable by one tired person?",
    tags: ["build", "shape"],
  },
  {
    id: "pit-boss",
    label: "casino pit boss",
    vantage:
      "You think in odds, house edge, comps, and whales. Where is the edge in this problem? Who is being comped and why? Who is counting cards against you? Turn incentives and payout structures into ideas.",
    tags: ["shape", "feral"],
  },
];

const SCATTER_RULES = `You are a generator, not a critic. Rules:
- Answer from reasoning alone. Do not read files, browse the web, or use any tools.
- Use exactly these JSON keys for each idea: "text" and "why". No other keys.
- Every idea is one phrase or one sentence. No paragraphs.
- The first three ideas anyone would give are banned. Assume the reader already had them. Go past them into the awkward middle.
- Weird, crude, and absurd ideas are welcome. They seed better ones.
- Do not evaluate, rank, or hedge. Generate only.`;

const CRITIC_RULES = `You are the critic. The generators are done; judge what they made.
- Answer from reasoning alone. Do not read files, browse the web, or use any tools.
- Score each idea 0-10 on three axes:
  spark = distance from the obvious default answer
  legs = could this actually run in practice
  aim = how directly it addresses the stated problem
- If an idea looks attractive but is a trap (hidden cost, false economy, will not scale, premature abstraction), give a one-line trap reason. Otherwise leave trap empty.
- Group all ideas into 3-6 clusters by their underlying angle, not surface keywords. A label names the angle, like "remove-the-middleman plays" or "make-it-self-healing plays".
- Use exactly these JSON keys: "scores" (objects with "id", "spark", "legs", "aim", optional "trap") and "clusters" (objects with "label" and "idea_ids"). Every id must be copied verbatim from the idea list.`;

const REFRAME_RULES = `You strip incidental anchors from a problem statement before brainstorming.
An anchor is an implementation detail (current stack, current tool, current process) that is not a real constraint but silently narrows every idea to variations of what already exists.
- Keep genuine constraints: legal, hard budget, hard deadline, physics, anything an answer would be rejected for violating.
- Strip "how it happens to be built today" unless removing it makes the problem meaningless.
- If you strip something, restate the problem as the underlying job to be done.
- Answer from reasoning alone. No tools.`;

const DEEPEN_RULES = `You are in hyperfocus. Take one promising idea and connect the dots.
- Answer from reasoning alone. Do not read files, browse the web, or use any tools.
- Sketch how it would actually work in 4-8 sentences.
- Name the load-bearing risk: the one thing that sinks it if wrong.
- Name the first concrete step a builder would take.
- Then give 3-5 child ideas that branch off it: variations, hybrids, things it unlocks.
- Use exactly these JSON keys: "sketch", "risk", "first_step", "children" (objects with "text" and "why").`;

type Idea = {
  id: string;
  frameId: string;
  text: string;
  why?: string;
  spark?: number;
  legs?: number;
  aim?: number;
  total?: number;
  trap?: string;
  cluster?: string;
};

type Args = {
  problem: string;
  context?: string;
  frames: number;
  ideas: number;
  top: number;
  model?: string;
  mode: "build" | "open";
  reframe: boolean;
  dryRun: boolean;
  concurrency: number;
  text: boolean;
  json: boolean;
  help: boolean;
};

function parseArgs(argv: string[]): Args {
  const a: Args = {
    problem: "",
    frames: 5,
    ideas: 6,
    top: 3,
    mode: "build",
    reframe: true,
    dryRun: false,
    concurrency: 6,
    text: false,
    json: false,
    help: false,
  };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--frames") a.frames = Number(argv[++i]);
    else if (v === "--ideas") a.ideas = Number(argv[++i]);
    else if (v === "--top") a.top = Number(argv[++i]);
    else if (v === "--model") a.model = argv[++i];
    else if (v === "--context") a.context = argv[++i];
    else if (v === "--mode") a.mode = argv[++i] === "open" ? "open" : "build";
    else if (v === "--no-reframe") a.reframe = false;
    else if (v === "--dry-run") a.dryRun = true;
    else if (v === "--concurrency") a.concurrency = Number(argv[++i]);
    else if (v === "--text") a.text = true;
    else if (v === "--json") a.json = true;
    else if (v === "--help" || v === "-h") a.help = true;
    else rest.push(v);
  }
  a.problem = rest.join(" ").trim();
  a.frames = Math.min(Math.max(a.frames, 2), 8);
  a.ideas = Math.min(Math.max(a.ideas, 2), 10);
  a.top = Math.min(Math.max(a.top, 1), 4);
  a.concurrency = Math.min(Math.max(a.concurrency, 1), 8);
  return a;
}

function selectFrames(n: number, mode: "build" | "open"): Frame[] {
  const shuffled = [...FRAMES].sort(() => Math.random() - 0.5);
  const grounded =
    mode === "build"
      ? shuffled.filter((f) => f.tags.includes("build") || f.tags.includes("shape"))
      : shuffled.filter((f) => f.tags.includes("open") || f.tags.includes("shape"));
  const feral = shuffled.filter((f) => f.tags.includes("feral"));
  const picked: Frame[] = [];
  const wildSlots = Math.max(1, Math.floor(n / 4));
  for (const f of feral) {
    if (picked.length >= wildSlots) break;
    picked.push(f);
  }
  for (const f of grounded) {
    if (picked.length >= n) break;
    if (!picked.find((p) => p.id === f.id)) picked.push(f);
  }
  for (const f of shuffled) {
    if (picked.length >= n) break;
    if (!picked.find((p) => p.id === f.id)) picked.push(f);
  }
  return picked.slice(0, n);
}

const API = "https://api.zo.computer/zo/ask";
const CALL_TIMEOUT_MS = 300_000;

let DRY = false;
let dryCounter = 0;

async function askZo(
  input: string,
  outputFormat: Record<string, unknown>,
  model?: string,
): Promise<any> {
  if (DRY) return dryAnswer(input, outputFormat);
  const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!token) throw new Error("ZO_CLIENT_IDENTITY_TOKEN not set; run this on Zo.");
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
    try {
      const body: Record<string, unknown> = { input, output_format: outputFormat };
      if (model) body.model_name = model;
      const res = await fetch(API, {
        method: "POST",
        headers: { authorization: token, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`zo/ask ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { output: unknown };
      return json.output;
    } catch (err) {
      if (attempt === 1) throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}

function dryAnswer(input: string, outputFormat: any): any {
  dryCounter++;
  const props = outputFormat?.properties ?? {};
  if (props.ideas)
    return {
      ideas: [
        { text: `dry idea ${dryCounter}a`, why: "stub" },
        { text: `dry idea ${dryCounter}b`, why: "stub" },
      ],
    };
  if (props.scores) {
    const ids = [...input.matchAll(/^(\S+) :: /gm)].map((m) => m[1]);
    return {
      scores: ids.map((id, i) => ({
        id,
        spark: (i * 3) % 10,
        legs: (i * 5 + 2) % 10,
        aim: (i * 7 + 1) % 10,
        ...(i % 4 === 3 ? { trap: "dry trap reason" } : {}),
      })),
      clusters: [{ label: "dry cluster", idea_ids: ids }],
    };
  }
  if (props.restated) return { restated: "", changed: false, note: "" };
  if (props.sketch)
    return {
      sketch: "dry sketch",
      risk: "dry risk",
      first_step: "dry step",
      children: [{ text: "dry child", why: "stub" }],
    };
  return {};
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const HELP = `scatterbrain: scatter a problem across isolated Zo child sessions, then converge.

usage: bun scatterbrain.ts "your problem" [flags]

flags (default in parens):
  --context "..."    constraints or background passed to every branch
  --frames N         how many cognitive frames to scatter across (5, max 8)
  --ideas N          ideas per frame (6, max 10)
  --top N            how many survivors get deepened (3, max 4)
  --mode build|open  frame bias: build for code-shaped work, open for product/content/life (build)
  --model ID         model for every child call (session default)
  --no-reframe       skip the anchor-stripping pass
  --concurrency N    parallel child sessions (6, max 8)
  --text / --json    force human render / force JSON (auto: text in a terminal, JSON when piped)
  --dry-run          stub every call; test plumbing for free
  --help             this

cost: roughly frames + top + 2 child sessions per run (defaults: ~10).
Runs on Zo Computer only; needs ZO_CLIENT_IDENTITY_TOKEN in the environment.`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  DRY = args.dryRun;
  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }
  if (!args.problem) {
    console.error(HELP);
    process.exit(1);
  }

  const log = (m: string) => console.error(`[scatterbrain] ${m}`);
  const plannedCalls = args.frames + args.top + 1 + (args.reframe ? 1 : 0);
  log(
    `run plan: ${args.frames} frames x ${args.ideas} ideas, ${args.top} deepened -> about ${plannedCalls} child sessions${DRY ? " (dry run, free)" : ""}`,
  );

  let scatterProblem = args.problem;
  let reframeNote: string | undefined;
  if (args.reframe) {
    log("reframe: stripping incidental anchors");
    try {
      const r = await askZo(
        `${REFRAME_RULES}\n\nPROBLEM:\n${args.problem}\n${args.context ? `\nCONTEXT:\n${args.context}\n` : ""}\nStrip incidental anchors, keep real constraints.`,
        {
          type: "object",
          properties: {
            restated: { type: "string" },
            changed: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["restated", "changed"],
        },
        args.model,
      );
      if (r?.changed && typeof r.restated === "string" && r.restated.trim()) {
        scatterProblem = r.restated.trim();
        reframeNote = r.note || r.restated;
        log(`reframe: changed (${(r.note || "").slice(0, 80)})`);
      } else {
        log("reframe: unchanged");
      }
    } catch (e) {
      log(`reframe failed, scattering from the original: ${e}`);
    }
  }

  const frames = selectFrames(args.frames, args.mode);
  log(`scatter: ${frames.length} frames -> ${frames.map((f) => f.id).join(", ")}`);

  const branches = await pool(frames, args.concurrency, async (frame) => {
    log(`scatter[${frame.id}]: start`);
    try {
      const out = await askZo(
        `${SCATTER_RULES}\n\nPROBLEM:\n${scatterProblem}\n${args.context ? `\nCONTEXT:\n${args.context}\n` : ""}\nYOUR FRAME, ${frame.label}:\n${frame.vantage}\n\nGenerate exactly ${args.ideas} distinct ideas under this frame.`,
        {
          type: "object",
          properties: {
            ideas: {
              type: "array",
              items: {
                type: "object",
                properties: { text: { type: "string" }, why: { type: "string" } },
                required: ["text"],
              },
            },
          },
          required: ["ideas"],
        },
        args.model,
      );
      const ideas: Idea[] = (out?.ideas ?? [])
        .map((r: any) => ({
          text: typeof r === "string" ? r : r?.text ?? r?.name ?? r?.idea ?? "",
          why: r?.why ?? r?.rationale ?? r?.reason,
        }))
        .filter((r: any) => typeof r.text === "string" && r.text.trim())
        .slice(0, args.ideas)
        .map((r: any, i: number) => ({
          id: `${frame.id}-${i + 1}`,
          frameId: frame.id,
          text: r.text.trim(),
          why: r.why,
        }));
      log(`scatter[${frame.id}]: ${ideas.length} ideas`);
      return ideas;
    } catch (e) {
      log(`scatter[${frame.id}]: failed (${e})`);
      return [] as Idea[];
    }
  });

  const all: Idea[] = branches.flat();
  if (all.length === 0) {
    console.error("[scatterbrain] no ideas came back; aborting");
    process.exit(2);
  }

  log(`hyperfocus: critic scoring ${all.length} ideas`);
  let criticOut: any = null;
  try {
    criticOut = await askZo(
    `${CRITIC_RULES}\n\nPROBLEM:\n${args.problem}\n\nIDEAS (id :: text):\n${all.map((i) => `${i.id} :: ${i.text}`).join("\n")}\n\nScore every idea and cluster all of them.`,
    {
      type: "object",
      properties: {
        scores: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              spark: { type: "number" },
              legs: { type: "number" },
              aim: { type: "number" },
              trap: { type: "string" },
            },
            required: ["id", "spark", "legs", "aim"],
          },
        },
        clusters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              idea_ids: { type: "array", items: { type: "string" } },
            },
            required: ["label", "idea_ids"],
          },
        },
      },
      required: ["scores", "clusters"],
    },
    args.model,
    );
  } catch (e) {
    log(`hyperfocus: critic failed (${e}); emitting the wide set unscored`);
  }
  const criticFailed = criticOut === null;

  const byId = new Map(all.map((i) => [i.id, i]));
  for (const s of criticOut?.scores ?? criticOut?.ideas ?? []) {
    const idea = byId.get(s?.id);
    if (!idea) continue;
    idea.spark = clamp10(s.spark ?? s.novelty);
    idea.legs = clamp10(s.legs ?? s.viability);
    idea.aim = clamp10(s.aim ?? s.fit);
    idea.total = idea.spark * 0.35 + idea.legs * 0.4 + idea.aim * 0.25;
    if (s.trap && String(s.trap).trim()) idea.trap = String(s.trap).trim();
  }
  const clusters: { label: string; ideaIds: string[] }[] = [];
  for (const c of criticOut?.clusters ?? []) {
    if (!c?.label) continue;
    const ids = (c.idea_ids ?? c.ideaIds ?? c.ids ?? []).filter((id: string) => byId.has(id));
    for (const id of ids) byId.get(id)!.cluster = c.label;
    clusters.push({ label: c.label, ideaIds: ids });
  }

  const traps = all.filter((i) => i.trap);
  const ranked = all
    .filter((i) => i.total !== undefined && !i.trap)
    .sort((a, b) => b.total! - a.total!);
  const shortlist = ranked.slice(0, Math.max(2, Math.min(4, args.top + 1)));
  const sleeper =
    shortlist.length === 0
      ? null
      : [...shortlist].sort(
          (a, b) => b.spark! + b.legs! * 0.5 - (a.spark! + a.legs! * 0.5),
        )[0];

  const toDeepen = ranked.slice(0, args.top);
  log(`hyperfocus: deepening top ${toDeepen.length}`);
  const deepened = await pool(toDeepen, args.concurrency, async (idea) => {
    try {
      const d = await askZo(
        `${DEEPEN_RULES}\n\nPROBLEM:\n${args.problem}\n\nFOCUS IDEA:\n${idea.text}${idea.why ? ` (${idea.why})` : ""}\n\nSIBLING IDEAS, recombine if useful:\n${all
          .filter((s) => s.id !== idea.id)
          .slice(0, 12)
          .map((s) => `- ${s.text}`)
          .join("\n")}`,
        {
          type: "object",
          properties: {
            sketch: { type: "string" },
            risk: { type: "string" },
            first_step: { type: "string" },
            children: {
              type: "array",
              items: {
                type: "object",
                properties: { text: { type: "string" }, why: { type: "string" } },
                required: ["text"],
              },
            },
          },
          required: ["sketch", "risk", "first_step", "children"],
        },
        args.model,
      );
      return {
        ideaId: idea.id,
        sketch: d?.sketch ?? d?.summary ?? "",
        risk: d?.risk ?? d?.load_bearing_risk ?? "",
        first_step: d?.first_step ?? d?.firstStep ?? "",
        children: (d?.children ?? d?.child_ideas ?? []).map((c: any) => ({
          text: typeof c === "string" ? c : c?.text ?? c?.name ?? "",
          why: c?.why ?? c?.rationale,
        })),
      };
    } catch (e) {
      log(`deepen[${idea.id}]: failed (${e})`);
      return { ideaId: idea.id, sketch: "(deepen failed)", risk: "", first_step: "", children: [] };
    }
  });

  const provocateur = [...all]
    .filter((i) => i.spark !== undefined)
    .sort((a, b) => b.spark! - a.spark!)[0];
  const provocation = provocateur
    ? `What if this one is right: ${provocateur.text}`
    : "What is the assumption nobody has named yet?";

  const result = {
    problem: args.problem,
    critic_failed: criticFailed,
    reframe: reframeNote ?? null,
    frames: frames.map((f) => ({ id: f.id, label: f.label })),
    ideas: all,
    clusters,
    shortlist: shortlist.map((i) => i.id),
    sleeper: sleeper?.id ?? null,
    traps: traps.map((i) => ({ id: i.id, text: i.text, trap: i.trap })),
    deepened,
    provocation,
  };

  const wantText = args.text || (!args.json && process.stdout.isTTY);
  if (wantText) renderText(result, byId);
  else console.log(JSON.stringify(result, null, 2));
}

function clamp10(n: unknown): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 0;
  return Math.min(10, Math.max(0, v));
}

function chip(i: Idea): string {
  if (i.spark === undefined) return "";
  return ` [S${Math.round(i.spark)} L${Math.round(i.legs!)} A${Math.round(i.aim!)}]`;
}

function renderText(r: any, byId: Map<string, Idea>) {
  const line = (s = "") => console.log(s);
  line(`PROBLEM: ${r.problem}`);
  if (r.critic_failed) line("NOTE: the critic pass failed, so the wide set below is unscored.");
  if (r.reframe) line(`REFRAME: ${r.reframe}`);
  line();
  line("WIDE SET");
  for (const c of r.clusters) {
    line(`  ${c.label}`);
    for (const id of c.ideaIds) {
      const i = byId.get(id);
      if (i) line(`    - ${i.text}${chip(i)}${i.trap ? "  [TRAP]" : ""}`);
    }
  }
  const orphans = r.ideas.filter((i: Idea) => !i.cluster);
  if (orphans.length) {
    line("  (unclustered)");
    for (const i of orphans) line(`    - ${i.text}${chip(i)}`);
  }
  line();
  line("SHORTLIST");
  for (const id of r.shortlist) {
    const i = byId.get(id);
    if (i) line(`  ${id === r.sleeper ? "* " : "- "}${i.text}${chip(i)}`);
  }
  if (r.traps.length) {
    line();
    line("TRAPS");
    for (const t of r.traps) line(`  - ${t.text} :: ${t.trap}`);
  }
  line();
  line("DEEPENED");
  for (const d of r.deepened) {
    const i = byId.get(d.ideaId);
    line(`  ## ${i?.text ?? d.ideaId}`);
    line(`  ${d.sketch}`);
    if (d.risk) line(`  risk: ${d.risk}`);
    if (d.first_step) line(`  first step: ${d.first_step}`);
    for (const c of d.children ?? []) line(`    + ${c.text}`);
    line();
  }
  line(`PROVOCATION: ${r.provocation}`);
}

main();
