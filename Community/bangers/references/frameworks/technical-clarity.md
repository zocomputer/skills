# Technical clarity: the frame and payload split

Read this when the content teaches how something works. It sits between
`voice-and-audience.md` (who is speaking) and `writing-quality.md` (what fails).

## Where this came from

This file is downstream of a public conversation on X in 2026, and the people
who started it deserve the credit:

- **[@geogristle](https://x.com/geogristle/status/2078492579511906771)** made
  the original point: you can get LLMs to write technical documentation that
  does not sound like AI by requiring them to follow ASD-STE100 Simplified
  Technical English. Earliest of the three posts below.
- **[@Voxyz_ai](https://x.com/Voxyz_ai/status/2078857039116156978)** made the
  argument that matters most here: stop banning words one at a time, because
  you never gave the model a writing system. Orwell's six rules from 1946 are
  the base block.
- **[@mikehostetler](https://x.com/mikehostetler/status/2079245119455150418)**
  carried the STE answer further.
- **[woosal1337](https://github.com/woosal1337/blog/tree/main/videos/ep01-the-cure-for-ai-slop)**
  ran the cross-model experiment and published a linter and results, showing a
  banned-word list barely moves the needle while a full writing system cuts
  measured violations sharply.
- **[danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill)**
  published an ASD-STE100 Claude Code skill. This file is not the first of its
  kind.

What this file adds is the frame/payload split below, which is the part none of
the sources address: what happens when you apply a controlled-language standard
to writing that also has to carry a voice.

Most technical content fails by applying one register to the whole piece. All
voice and the explanation goes hand-wavy: the reader enjoys it and cannot
repeat it. All specification and the piece reads like a manual: correct,
unshareable, unfinished. Teaching content needs both registers, assigned
deliberately.

## The split

**Frame = the author's voice.** Hook, stance, the story of what happened, the
cost of getting it wrong, transitions, the judgment, the call to action. This
is where the reader decides whether to keep going and whether to trust the
person talking. Personality lives here. Apply the creator profile, not the
clarity rules below.

**Payload = technical clarity.** The passages where the reader must understand
a mechanism: definitions, steps, what the system does, why the failure
happens. This is where the reader is working, and where vague writing costs
them the most. Apply the discipline below.

A starting ratio for a teaching post: frame carries the first and last fifth,
payload carries the middle. Adjust to the piece.

## Payload discipline

Adapted from ASD-STE100 Simplified Technical English, a controlled-language
standard for aircraft maintenance documentation. It exists because airlines
asked for it: roughly 80% of them are not native English speakers, and per the
standard's own documentation, complex technical instructions can be
misunderstood, and misunderstandings can lead to accidents. Working group
formed 1983, first released 1986 as the AECMA document, still maintained. The
full standard is free at https://www.asd-ste100.org/.

1. **One name per thing.** Choose the term on first use and never rotate it.
   If it is a "context file" in paragraph two, it is not a "memory doc" in
   paragraph five. Synonym rotation is the fastest way to lose a reader who is
   tracking a mechanism.
2. **One idea per sentence.** Around 25 words in payload prose, closer to 20
   for steps and instructions.
3. **Active voice with a named actor.** "The parser reads the file", not "the
   file is read". The reader is building a model of who does what.
4. **Verbs, not nominalized verbs.** Analyze, not "perform an analysis of".
   Help, not "provide assistance".
5. **Cut hedge stacks.** "This may potentially help improve" says nothing. It
   either does the thing or it does not. Real uncertainty stated plainly
   ("I have not tested this at scale") is honesty, not hedging. Keep that.
6. **Show quality, never claim it.** No seamless, robust, powerful, blazing,
   effortless. Give the number, the before and after, or the failure it
   prevents.
7. **No semicolons in payload prose.** Use a period.
8. **Concrete over abstract.** The exact command, the exact error text, the
   exact file. Screenshots and code blocks beat description.

## What survives the discipline

Do not sand these off in the name of clarity:

- Contractions, if the author uses them.
- The aside that names the annoying part.
- The judgment call. A specification has no opinions. The author does, and the
  opinion is often why the piece is worth reading.
- Humor and intensity where the author has earned them.

Orwell's sixth rule governs the whole document: break any of these rules
before you write something barbarous. Clarity is the goal. Compliance is not.

## Orwell's six rules

From "Politics and the English Language" (1946), paraphrased:

1. Never use a figure of speech you are used to seeing in print.
2. Never use a long word where a short one works.
3. If you can cut a word, cut it.
4. Never use the passive where the active works.
5. Never use jargon when everyday English works.
6. Break any of these rules before writing something barbarous.

## Kill-list: applies to the WHOLE document, frame included

The payload discipline above governs only the payload. This kill-list governs
everything, voice sections included. Do not skip it on the frame because the
frame is "yours". The frame is exactly where these creep back in, because it is
the part no length rule is watching.

### Frame-specific tells

These are the ones that survive a clean payload and still make a piece read as
machine-written:

- **Closer cadence.** Every section ending on a short, quotable, self-satisfied
  line. One or two landings in a piece is voice. Landing every single section is
  the single loudest tell there is, and it is the one writers miss, because each
  line looks good alone. Check the last sentence of every section in a column.
  If they all punch, flatten most of them. Let sections end mid-thought, on a
  qualifier, or on an ordinary sentence.
- **Significance flagging.** "That is the whole trap", "this is the part I would
  keep", "if you take one thing from this", "that is the whole trick". Telling
  the reader what matters instead of letting the writing carry it. Cut every
  instance.
- **Manufactured symmetry.** "I did not have an X problem. I had a Y problem."
  Reads clever, teaches nothing the plain sentence would not.
- **Too clean an arc.** Real accounts have loose ends. If nothing in the piece is
  unresolved, uncertain, or admitted-to-be-still-wrong, it was probably smoothed
  by a model. Put the loose end back.
- **Uniform paragraph length.** Three to four lines each, all the way down. Vary
  it for real, driven by how much the thought needs.

### General tells

These hit hardest in teaching content, because the reader is already working:

- Significance inflation: "plays a pivotal role", "underscores the
  importance", "a testament to", "the evolving landscape of".
- Copula avoidance: "serves as" and "boasts" where "is" and "has" work.
- Negative parallelism: "it's not just a cache, it's a paradigm shift".
- Rule-of-three triples that sound complete and teach nothing.
- Vague attribution: "experts argue", "industry reports suggest". Name the
  source or cut the claim.
- Filler vocabulary: delve, intricate, interplay, meticulous, leverage,
  facilitate, showcase, foster, robust, seamless.
- Formatting tells: bold on every other phrase, Title Case Headings, and a
  closing paragraph that restates the piece.

## Check before delivering

- Can a reader follow the mechanism and repeat it with the post closed?
- Is every concept called exactly one name?
- Did any sentence claim quality instead of showing it?
- Does the frame still sound like the author, or did the discipline flatten
  the piece?
- Would deleting any sentence lose information? If not, delete it.
- **Read the last sentence of every section, in order, on their own.** If they
  all land like punchlines, the piece reads as machine-written no matter how
  good the payload is. Flatten most of them.
- Is anything in the piece left genuinely unresolved? If not, you smoothed
  something you should not have.

A mechanical check catches the countable defects and nothing else. It will
pass a clean, confident, hollow paragraph. It cannot tell you whether you had
anything to say.
