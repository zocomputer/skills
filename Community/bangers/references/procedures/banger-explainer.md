# Banger Explainer — teaching content that survives being shared

Teaching content fails in two directions. Too much voice and the reader
enjoys it but cannot repeat it. Too much specification and it reads like
documentation nobody shares. This procedure assigns each register to the part
of the piece it is actually good at.

## Load first

- `references/frameworks/voice-and-audience.md` — the
  audience profile and the creator's hard constraints.
- `references/frameworks/technical-clarity.md` — the
  frame/payload split and the payload discipline. Core reference here.
- `references/frameworks/writing-quality.md` — the
  living gate, run before delivery.
- The target platform section of
  `references/platforms/platform-playbook.md`.

## Freshness gate

Before using any platform benchmark, algorithm claim, or numeric performance
claim from this skill or the playbook, check
`references/research/source-ledger.md` for non-expired support. If support is
missing or past review, run `references/procedures/banger-research.md`, label the claim unverified, or
omit it.

## Step 1: name the mechanism

Write one sentence, for yourself, not the reader: **what does the reader
understand after this that they did not before?** One mechanism per piece. If
it takes two sentences, it is two pieces.

Then name the wrong model the reader probably holds right now. Strong
technical content replaces a wrong model rather than filling an empty one.
That wrong model is usually the hook.

## Step 2: check the proof

Before drafting, name:

- the artifact (repository, file, commit, screenshot, error text, benchmark),
- what actually happened, including the part that failed,
- what has not been tested, stated plainly.

If there is no artifact, this is an opinion piece, not an explainer. Route to
`references/procedures/banger-threads.md` or `references/procedures/banger-longform-written.md` and say so.

## Step 3: set the explanation depth

Use the audience profile from `voice-and-audience.md`. The prime directive
governs: match vocabulary to the audience's actual sophistication.

- **Non-expert audience** — define every primitive in the same breath, with a
  plain analogy. Show the exact screen, prompt, and result. Payload gets
  longer, steps get smaller. Never talk down.
- **Practitioner audience** — insider shorthand is free, and over-explaining
  burns their time. Spend the space on tradeoffs, failure modes, and what you
  would do differently.

## Step 4: draft with the split

**Frame (author voice, not the clarity rules):**

- A hook that names the specific wrong model or the specific pain, not the
  category.
- The story: what you were doing, what broke, what it cost.
- The judgment: what you now think, and how confident you are.
- The call to action native to the platform.

**Payload (technical clarity):**

- One name per concept, held for the whole piece.
- One idea per sentence, roughly 25 words, steps closer to 20.
- Active voice with a named actor: "the parser reads the file".
- Verbs, not nominalizations. Numbers shown, not quality claimed.
- Concrete artifacts: real commands, real errors, real paths.

Keep contractions, asides, humor, and opinion inside the payload where they
carry weight. Discipline is not the same as flattening.

## Step 5: platform shape

- **X or Bluesky thread** — one mechanism step per post. Frame is post one and
  the last post. Payload posts carry a code block or screenshot where
  possible. Never longer than the mechanism requires.
- **LinkedIn** — hook in the first 150 characters, wrong-model framing, then
  three or four payload beats in short paragraphs. End on the judgment plus a
  question. No links in the body.
- **Newsletter or Substack** — a header per mechanism step, a diagram or code
  block per step, pull-quote the judgment. Provide standalone Notes drawn from
  the payload, not the frame.
- **Video description or docs-style post** — payload dominates, frame shrinks
  to two lines.
- **Facebook group** — do not use this procedure. Route to
  `references/procedures/banger-longform-written.md`, question-led and short.

## Step 6: verify before delivering

Run the `writing-quality.md` gate, then these:

1. Could a reader repeat the mechanism with the post closed?
2. Is every concept called exactly one name?
3. Did anything claim quality instead of showing it?
4. Does the frame still sound like the author said it out loud?
5. Is every number, quote, and result traceable to a real artifact?
6. Are the creator's hard constraints (banned punctuation, phrases, tone)
   satisfied?

## Output format

Lead with the finished asset, ready to paste, formatted for the platform.
Then:

- the mechanism sentence and the wrong model it replaces,
- the artifact each claim traces to,
- anything labeled unverified,
- the approval needed next.

Drafting is free. Publishing, scheduling, and outreach need the creator's
explicit per-item approval.
