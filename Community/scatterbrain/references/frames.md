# Frame catalog

A frame is a deliberately distorted vantage point. It is not a persona for
flavor; it is a forcing function that pushes attention somewhere the
default line of thinking would never walk. Each scattered branch gets
exactly one frame and nothing else.

Tags: `build` (code-shaped work), `shape` (design and strategy), `open`
(product, content, life-ops), `feral` (deliberately weird; every run gets
at least one).

| Frame | What it forces | Tags |
|---|---|---|
| night dispatcher | Loads that must move tonight: batching, rerouting, what waits for morning | build, shape |
| salvage mechanic | Build only from parts already in the yard; buying new is cheating | build, open |
| first-time user, no manual | Naive moves; convention is invisible | open, feral |
| paid saboteur | How would this be made to fail quietly, then flip each into a defense | build, shape |
| project coroner | Write the cause-of-death report two years out, then design against it | shape, open |
| street vendor | The cart version: crudest thing that does the load-bearing job today | build, open |
| billionaire skunkworks | Ten years, no competitors, shipping small is illegal | shape, feral |
| mycologist | The fungal version: decentralized, redundant, routes around damage | build, feral |
| air traffic controller | Flows, separation, holding patterns, handoffs | build, shape |
| lockpicker | The abusive-but-legal path the designer never intended | build, feral |
| inversion | Guarantee the opposite, then negate each answer back | build, shape, open |
| assumption thief | Steal the one thing everyone treats as fixed | build, shape, feral |
| the stranger who inherits this | Five years out, no docs, one tired owner; design so they sleep | build, shape |
| casino pit boss | Odds, house edge, comps, whales; incentives as ideas | shape, feral |

The live definitions, with each frame's full vantage prompt, are in
`scripts/scatterbrain.ts` in the `FRAMES` array. That file is the source
of truth; this table is the map.

## Writing a new frame

A good frame passes three tests:

1. **It has a physics.** The character brings hard constraints and native
   mechanisms with it (driver hours, separation minimums, house edge), not
   just a costume. "Pirate" is a costume. "Night dispatcher" has physics.
2. **It bans the default.** Under the frame, the textbook answer should be
   unnatural or impossible to reach. That is the point of distortion.
3. **It generalizes.** It should produce ideas for a naming problem and an
   architecture problem and a pricing problem. If it only works on one
   problem type, it is a template, not a frame.

To add one: append an entry to `FRAMES` in the script with an `id`,
`label`, a `vantage` prompt written to the character in second person, and
tags. Keep the vantage under 60 words and end it with a question that
demands ideas, not analysis.
