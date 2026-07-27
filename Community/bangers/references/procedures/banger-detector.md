# Banger Detector — authenticity verification and honest disclosure

Read this whole section before running anything. Most requests that arrive
here ask for the wrong outcome, and delivering it would make the writing
worse.

## What a detector score is, and is not

AI text detectors mostly measure two statistical properties: **perplexity**
(how predictable each next word is) and **burstiness** (how much sentence
length and structure vary). Low perplexity and low burstiness read as machine
generated.

That is a proxy for a style, not evidence of authorship. The consequences are
measured and severe:

- Liang et al. (2023, *Patterns*) found detectors falsely flagged **61.3% of
  essays by non-native English writers**, while classifying native-speaker
  essays nearly perfectly. **97.8% of TOEFL essays** were flagged by at least
  one detector.
- In the same work, rewriting non-native essays with more elaborate
  vocabulary dropped the false positive rate from 61.22% to 11.77%. The
  detector was measuring vocabulary range, not authorship.
- Technical, legal, and scientific writing is flagged for the same reason. A
  field's papers reuse terminology and structure by necessity. Detectors read
  that necessary uniformity as machine output.
- Recent formal work argues the false positive problem is **structural**: any
  text-only detector with real detection power must produce false accusations
  against some human populations. Better engineering does not remove this.

A detector cannot prove a human wrote something, and it cannot prove a machine
did. Treat every score as weak adversarial evidence.

## The trap specific to this suite

`technical-clarity.md` deliberately produces short sentences, one name per
concept, consistent structure, and plain vocabulary. That is **low perplexity
and low burstiness by design**. Applying it correctly will often *raise* a
draft's AI score while *improving* the writing.

Never resolve that conflict by damaging clarity. If a piece is clear, sourced,
and genuinely the author's, a high detector score is the detector being wrong.
Record it and move on.

## Step 1: verify authenticity, which is not a score

These checks decide whether a draft is genuinely the author's. Run them first,
and run them even when no detector is available.

1. **Provenance.** Every number, quote, story, date, result, and named
   specific traces to a real artifact: a file, commit, screenshot, measurement,
   published post, or something the author said. Anything unsourceable gets
   cut, not softened. This is the check that actually matters.
2. **Judgment.** The piece makes a call that only this author would make, from
   their own experience. Balanced summary with no position is the real tell.
3. **Earned texture.** The concrete detail that could not be generated: the
   exact error string, what it cost, the part that went wrong, the thing they
   changed their mind about.
4. **Real variation.** Sentence rhythm varies because the thinking varies, not
   because variation was manufactured. Read it aloud.
5. **Constraint compliance.** The creator profile's banned punctuation,
   phrases, and tone rules are satisfied.
6. **Say-it-out-loud.** Would the author speak this line to a peer? Rewrite
   any line they would not.

A draft that passes all six is authentic regardless of what any detector says.

## Step 2: decide whether to run a detector at all

Read `detector_mode` from the creator profile.

- `off` — do not run one.
- `requested` — run only when the author asks.
- `panel` — run for outward-facing prose when detector access exists. If
  access does not exist, record `not run`. Never imply a run happened.

Skip detectors entirely for private drafts, internal docs, and anything the
author is not publishing under their name.

## Step 3: run the panel

- Use at least two independent, currently accessible services. One score is
  noise.
- Never paste private, unpublished, or client-confidential drafts into a
  third-party detector. That is a disclosure of the author's material to an
  outside service. Ask first, every time.
- Record each run in `references/research/detector-runs.md`: date, input
  identifier or hash, service and version, result, highlighted passage
  locator, the mapped writing defect, the revision, and the rerun result.
- Use only scrubbed samples in a public ledger. Private drafts go in a private
  overlay.

## Step 4: map highlights to real defects, or stop

A score never triggers a rewrite. For each highlighted passage, ask whether it
maps to a genuine defect from `writing-quality.md`:

- generic opening, empty transition, or ornamental conclusion,
- unsourced claim or vague authority,
- stacked triads, symmetric paragraphs, or forced parallelism,
- hedging or breathless certainty,
- vocabulary the author never uses.

Revise only those. Rerun once. **Stop after two detector-led passes**, whatever
the score says. Truth, clarity, rhythm, and authentic voice outrank every
score.

## Forbidden moves

These damage the work and the author's credibility:

- Inserting typos, grammatical errors, or awkward phrasing to look human.
- Running the draft through a "humanizer" tool.
- Padding with filler or synonym rotation to raise perplexity. That
  reintroduces exactly what the suite removes.
- Altering a true, clear, author-authentic passage only to move a number.
- Presenting a detector score as proof of authorship, in either direction.
- Publishing a claim that content "passes AI detection" as a feature. It is
  unverifiable, it varies by service and by week, and it invites an easy
  public rebuttal.

## Step 5: disclosure

Being open about AI assistance is a stronger position than any score, and it
is the only one that survives scrutiny.

**The principle:** disclose the process honestly, and be specific about what
the tool did and what the human did. Readers do not object to tool use. They
object to being misled about whose thinking they are reading.

**What an honest disclosure covers:**

- The opinions, judgments, and conclusions are the author's.
- Every factual specific was verified by the author against a real artifact.
- The author takes responsibility for errors.
- Where the tool genuinely helped: drafting, structuring, editing, research
  assistance, checking prose against a written standard.

**What to avoid:**

- Claiming "100% human written" when a tool was used. One screenshot ends
  that.
- A blanket AI disclaimer stapled to everything, which reads as legal cover
  rather than honesty.
- Overclaiming the reverse, implying the tool did the thinking when the author
  did.
- Making the disclosure the subject of the piece when it is a footnote.

**Placement:** one plain line, where a reader would want it. In a byline, an
author's note, a repository README, or an about page. Not in every paragraph.

Draft the disclosure in the author's voice, offer it, and let the author
choose the wording. Never publish a disclosure the author has not approved.

## Output format

Report, in this order:

1. The six authenticity checks, pass or fail, with the failures named.
2. Detector runs: service, date, result, or `not run` with the reason.
3. Highlighted passages that mapped to a real defect, and the revision made.
4. Highlighted passages dismissed, and why.
5. The proposed disclosure line, if the piece needs one.
6. What still needs the author's approval.

Never report a score without the authenticity result beside it. The score is
the weaker signal and must never be presented as the headline.
