# Banger Carousels — swipeable slide content that gets saved

Carousels are the highest engagement-by-reach format on Instagram and a top-reach format on LinkedIn, and they earn SAVES (a heavily weighted signal). The craft: one idea per slide, a slide 1 that stops the scroll, and a last slide that earns the save/share.

## Freshness gate

Before applying a platform benchmark, algorithm claim, policy, feature-availability statement, or numeric performance claim from this skill or the platform playbook, check `references/research/source-ledger.md` for non-expired support. If support is missing or past its review date, run `references/procedures/banger-research.md`, qualify the claim as unverified, or omit it. Never present a legacy value as current truth.
## Load first
- `references/frameworks/writing-quality.md` for the living human-writing test and creator-specific constraints. Treat detector results as weak evidence.
- `references/frameworks/voice-and-audience.md` (the creator's own defined audience — ask once if it isn't set) + `references/creators/matt-pocock.md` (one concept, example-first, make-the-invisible-visible).
- `references/platforms/platform-playbook.md` §4 (Instagram carousels — 8–10 slides, 4:5 1080×1350, strong slide 1 AND 2 for the re-serve) and §6 (LinkedIn document carousels — 5–10 slides, PDF, 1080×1080 or 1080×1350).

## Structure (the swipe arc)
1. **Slide 1 — the hook.** A bold promise, curiosity gap, or contrarian line + minimal visual. This is the whole ballgame; it decides the swipe. (On Instagram, make slide 2 strong too — IG re-serves the carousel using different cover slides.)
2. **Slides 2–(N-1) — one idea each.** One takeaway per slide, big readable text, an example or the actual thing shown (a screenshot of the real result, a before/after, a diagram). Keep momentum — each slide should pull to the next ("but here's the catch →").
3. **Final slide — the payoff + CTA.** Recap the value in one line and explicitly ask for the save/share ("Save this for the next time you…", "Send to someone who needs it"). Optionally a soft follow CTA.

## Design rules
- **One idea per slide.** If a slide has two points, split it. 8–10 slides for IG, 5–10 for LinkedIn (engagement drops after ~10).
- **Readable at a glance** — large type, high contrast, generous margins, consistent template. Keep key text centered/safe.
- **Format:** Instagram 4:5 (1080×1350) images; LinkedIn export as a **PDF** document (1080×1080 or 1080×1350).
- **Keyword-rich caption** (IG search is keyword-driven now, not hashtags) + 3–5 tags.

## Building the file
This skill produces the slide CONTENT and layout. To generate an actual deliverable:
- For a polished slide deck / PDF carousel, use the **pptx** skill (read its SKILL.md) to build the slides, then export to PDF for LinkedIn. For visual theming/colors/fonts, the **theme-factory** skill can style it.
- For image carousels, you can also produce a clean single-file HTML layout (one slide per section, correct aspect ratio) the user can screenshot/export, or hand a spec to their design tool (Canva/Figma).
Always research/confirm the content FIRST, then read the format skill's SKILL.md before building (never anchor on document mechanics before the content is right).

## Output format
Deliver a **slide-by-slide script**: for each slide give the **headline text**, any **body/subtext**, and a **[visual: ...]** note (what to show/screenshot). Call out slide 1 (and IG slide 2) as the hook slides and the final slide as the save-CTA. Provide the post **caption** (keyword-front-loaded) + hashtags. Then, if the user wants the actual file, build it via the pptx skill and deliver with SendUserFile.

## Quality bar
Confirm slide 1 stops the scroll on its own, every slide holds exactly one idea, the deck is readable at thumbnail size, and the last slide gives a concrete reason to save/share.
