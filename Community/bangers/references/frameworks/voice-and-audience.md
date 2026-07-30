# THE VOICE & AUDIENCE PROFILE — Define who you're talking to, then adapt the mechanics
Read this FIRST whenever producing content. The four reference creators (Fireship, Matt Pocock, Theo, Primeagen) all serve TECHNICAL/dev audiences. The creator you're helping almost certainly serves someone else. The creators' MECHANICS are the gold; their jargon, examples, and in-group signaling are fuel for THEIR audience only. This file is how you keep the engine and swap the fuel — for any niche.

## STEP 1: BUILD THE AUDIENCE PROFILE (do this before writing anything)
If you don't already know who this creator serves, **ask them once at the start of the session**, store the answers, and apply them to everything you produce. Five questions:

1. **Who are they?** (role, life stage, identity — "new parents," "junior devs," "small-business owners," "home cooks who hate meal planning")
2. **What do they want?** (the outcome they'd pay for — save time, make money, get fit, ship code, feel less overwhelmed)
3. **What do they fear or struggle with?** (the thing that keeps them stuck — feeling behind, wasting money, looking dumb, information overload, past failures)
4. **How sophisticated are they?** (total beginner ↔ practitioner ↔ expert — this drives every vocabulary decision below)
5. **What do they respond to?** (proof? humor? authority? relatability? "you can do this" warmth? spicy takes?)

If the creator cannot answer crisply, help them describe one real person who follows them. A vivid single person beats a vague demographic. If answers are unavailable, state the assumption and proceed. Never silently guess.

## Step 2: Record hard creator constraints

Store these beside the audience profile so every writing route can enforce them:

```yaml
creator_name: ""
recent_approved_samples: []
punctuation_bans: []
prohibited_phrases: []
required_tone: []
forbidden_tone: []
detector_mode: "off" # off | requested | panel
private_overlay_path: ""
```

`punctuation_bans` and `prohibited_phrases` are automatic failures. `detector_mode: panel` requires the detector workflow in `writing-quality.md` when accessible. Keep private values in a local overlay rather than this public template.

## THE PRIME DIRECTIVE
**Match vocabulary to the audience's ACTUAL sophistication — it cuts both ways.**
- **Non-expert audience:** no unexplained jargon. When a technical term is unavoidable, define it in the same breath with a plain analogy. Assume zero prior knowledge; never make them feel stupid for lacking it.
- **Expert audience:** use insider shorthand freely — over-explaining basics signals you're not one of them and burns their time. Skip the 101; get to the insight.
- The test: **would one real member of this audience understand every sentence WITHOUT feeling either lost or patronized?** If not, rewrite.

## HOW TO TRANSLATE EACH CREATOR'S MECHANIC (keep the move, change the target)

**Fireship → density + humor, calibrated to the audience.** Keep: zero filler, fast pace, one punchy idea after another, deadpan jokes, "X in 100 seconds" compression. Change: density means VALUE-PER-SECOND for THIS audience, not information overload. For beginners (in any niche), density = "no wasted words" — cut the concept count, keep the pace. For experts, density = more real substance per minute. Examples: "5 stretches in 100 seconds" (fitness), "Index funds explained in 100 seconds" (finance), "Your CRM's hidden feature in 60 seconds" (B2B software).

**Matt Pocock → one concept, shown not told.** Usually the single most portable mechanic. Keep: teach exactly ONE thing per piece, example-first, make-the-invisible-visible (show the actual input and the actual result on screen), warm low-ego "let me show you," cast the viewer as capable. Point it at one concept in YOUR niche: one knife technique (cooking), one form fix (fitness), one budgeting move (finance), one prompt trick (AI for beginners), one settings toggle (B2B software). The screenshot reveal = show the real before/after — the messy dashboard vs. the clean one, the burnt pan vs. the seared steak.

**Theo → react to what's happening now, with an opinion.** Keep: cover this-week news in your niche (a new product, a study, a viral claim, a rule change), have a real take, "here's what this actually means for YOU." Change the target of the take to your audience's decision: "is this new supplement worth it?" (fitness), "does this rate change affect your mortgage?" (finance), "is this viral kitchen gadget hype?" (cooking), "should your team switch tools?" (B2B), "is this parenting trend evidence-based?" (parenting). You become the trusted filter who tells overwhelmed people what deserves their attention. Steelman the other side + be correctable stays, in every niche.

**Primeagen → react-and-read energy + the funnel, tuned to your audience's culture.** Keep: borrow someone else's content as the skeleton (react to an article/post/demo/video so you never face a blank page), manufacture energy with genuine reactions and volume swings, engineer clippable spikes, go-long-then-shred one session into many pieces, credential-anchored takes undercut with humility. Change: swap HIS in-group humor ("skill issue," dev in-jokes) for YOUR audience's shared language and running gags — every niche has them. If your audience is beginners, your authenticity marker is "I was confused by this too, here's what finally clicked." If experts, it's battle scars: "I've done this 200 times; here's where it breaks."

## VOICE (derive the creator's own blend)
Don't clone any of the four — **blend them in the creator's own proportions.** The four dials:
- **Energy** (Prime/Theo): alive, opinionated, reactive. How loud is this creator, honestly?
- **Pedagogy** (Pocock): patient, one-thing-at-a-time, "you've got this." How much is this creator a teacher?
- **Tightness** (Fireship): no filler, respect the viewer's time. Non-negotiable at some level for everyone.
- **Humor**: deadpan (Fireship), chaotic (Prime), dry (Theo), warm (Pocock) — or the creator's own. Never forced.

Ask the creator (or infer from their existing content): which two dials are naturally highest? Write to those. Then anchor the voice with a **recurring promise** — the one sentence their audience should associate with them (e.g., "You don't need to be technical, you just need the exact steps" / "Evidence, not bro-science" / "Restaurant results with grocery-store ingredients"). Use it as a consistency check on every piece.

## VOICE DO / DON'T
DO: use "you," short sentences, concrete examples with real numbers/outcomes, before/after, "here's exactly what to do/type/click," name the audience's fear and dissolve it ("this feels overwhelming — it's actually three steps"). Show the real screen/pan/spreadsheet/rep. Give one win they can get today.
DON'T: mismatch vocabulary to sophistication (jargon at beginners, baby-talk at experts), hype without proof, talk down, hedge everything, bury the useful part, borrow another niche's in-jokes, be a hype-man with no substance.

## THE SUBSTANCE BAR (Theo's + Prime's rule, applied)
Every piece must pass: **would this audience walk away able to actually DO one new thing, or UNDERSTAND one thing they were confused about?** Entertainment without a takeaway is empty; a takeaway without energy is boring. Bangers have both.

## FORMATS THAT FIT (fill in [your topic])
- "I tried [tool/product/method] so you don't have to — here's the verdict."
- "The one [technique/setting/move] that [does a useful real-life thing]."
- "You're doing [common task] wrong. Here's the fix." (Pocock's before/after)
- "New [thing in your niche] dropped. Do you actually need it? (honest take)" (Theo react)
- "[N] [tools/tricks/foods/exercises] that do [boring or hard task] in [tiny time]." (Fireship density)
- "Watch me [do a real thing in your niche] in real time." (Prime react-and-do)
- "[Big claim going around]. Let's test it." (react + verdict, any niche)
Adapt the noun, keep the shape. The shapes are audience-agnostic; only the fill changes.
