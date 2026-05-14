# Visual Identity Gate

Before writing any composition HTML, define visual identity. Do not write default or generic colors.

## Check in order

1. `DESIGN.md` exists in the project: read it and use exact colors, fonts, motion rules, and "What NOT to Do" constraints.
2. `visual-style.md` exists: read it and apply `style_prompt_full` plus structured fields.
3. User named a style: read `visual-styles.md` and generate a minimal `DESIGN.md` with:
   - `## Style Prompt`
   - `## Colors` — 3-5 hex values with roles
   - `## Typography` — 1-2 font families
   - `## What NOT to Do` — 3-5 anti-patterns
4. None of the above: ask exactly three questions before writing HTML:
   - What's the mood: explosive, cinematic, fluid, technical, chaotic, warm?
   - Light or dark canvas?
   - Any brand colors, fonts, or visual references?

Then generate a minimal `DESIGN.md` from the answers.

## Required traceability

Every composition must trace palette and typography back to one of:

- `DESIGN.md`
- `visual-style.md`
- explicit user direction

If you reach for `#333`, `#3b82f6`, Roboto, Inter, Arial, or generic blue-purple gradients, you skipped the gate.

## Division of responsibility

- `DESIGN.md` defines what the video looks like: palette, typography, visual references, anti-patterns.
- `house-style.md` defines how things move when no specific animation direction is provided.
