# Step 6 — Build Compositions

Goal: build the video from the storyboard with HyperFrames HTML/CSS/GSAP.

## Before writing HTML

Read:

- `DESIGN.md`
- `SCRIPT.md`
- `STORYBOARD.md`
- `Skills/hyperframes/SKILL.md`
- `Skills/hyperframes/references/composition-contract.md`
- `Skills/hyperframes/references/layout-before-animation.md`
- `Skills/hyperframes/references/transitions.md`
- `Skills/hyperframes/references/quality-checks.md`

## Build process

1. Scaffold with `npx hyperframes init` if not already scaffolded.
2. Build static hero-frame layout first.
3. Add GSAP entrance animations.
4. Add scene transitions.
5. Add media and separate audio tracks.
6. Add captions if needed.
7. Run lint/validate/inspect after each substantial composition.
8. Self-review before proceeding to the next composition.

## Self-review checklist

- Does the hero frame match `STORYBOARD.md`?
- Does palette/typography trace to `DESIGN.md`?
- Does every element enter?
- Are there transitions between scenes?
- Are there accidental overlaps?
- Are assets placed intentionally, not just pasted in?
- Is there motion on screenshots or static images?
- Are captions readable and inside safe areas?

## Gate

Every composition is self-reviewed. No overlapping elements, misplaced assets, or static images without motion.
