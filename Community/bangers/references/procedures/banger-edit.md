# Banger Edit — edit sheets, captions & markers for any editor (+ OBS recording)

This skill turns a script or a raw recording into the assets an editor actually needs: a cut plan, caption files, markers, and overlay cues — usable in **DaVinci Resolve, Adobe Premiere, CapCut, or Descript**, with **OBS** for recording. It produces text/files the user imports; it doesn't run the NLE. Ask (or infer from context) which editor the user works in, and tailor the import notes to it.

## Freshness gate

Before applying a platform benchmark, algorithm claim, policy, feature-availability statement, or numeric performance claim from this skill or the platform playbook, check `references/research/source-ledger.md` for non-expired support. If support is missing or past its review date, run `references/procedures/banger-research.md`, qualify the claim as unverified, or omit it. Never present a legacy value as current truth.
## Load first
- `references/frameworks/writing-quality.md` for captions, overlays, title cards, and any corrected transcript text.

- `references/creators/fireship.md` (the editing DNA: zero dead air, visual change every 1–5s, reveal step-by-step, pointer on the live element, cheap assets + precise timing) + `references/creators/primeagen.md` (clip the emotional spikes).
- `references/platforms/platform-playbook.md` (specs + safe zones for the target platform; §10 for the film-once-cut-everywhere reframe rules).

## What this skill can produce
1. **Cut sheet / Edit Decision List (human-readable).** A timestamped table: `In–Out · what happens · cut type (jump cut / J-cut) · [B-roll or screen-capture] · [on-screen text] · [SFX/zoom/punch-in] · note`. Works in any editor — the user executes it on their timeline. Enforce Fireship discipline: razor out every pause/um (zero dead air), a visual change every 1–5s, jump-cut the talking head, an arrow/pointer on whatever is being discussed. (Descript users can execute much of the cut by deleting the same lines in the transcript — note the transcript lines to delete alongside the timecodes.)
2. **Caption assets.** Either a **burned-in caption script** (line-by-line on-screen text with timings, for short-form watched muted) or a proper **.srt subtitle file**. Import steps per tool:
   - **Resolve:** Timeline → Import Subtitle, drop onto a subtitle track.
   - **Premiere:** File → Import the .srt, drag to the Captions track (or Text panel → Captions → import).
   - **CapCut / Descript:** auto-caption first, then correct the text against the provided caption script (their auto-captions are the fast path; your script is the accuracy pass).
   - **YouTube:** upload the .srt directly in Studio for closed captions.
   Keep caption text inside the platform safe zone.
3. **Marker / chapter CSV.** A CSV of timeline markers (name, timecode, color, note) to drop chapter points, clip-worthy moments, and B-roll spots — also usable to plan Shorts cutdowns. Resolve imports marker CSVs directly (use its expected columns); Premiere users can add the markers from the sheet manually or via extensions; CapCut/Descript users treat it as a working checklist while cutting. Always usable as YouTube chapter text for the description.
4. **Vertical reframe plan.** For repurposing 16:9 → 9:16: which subject/region to keep centered per shot, where captions/CTA sit clear of platform UI, and where the editor's reframe/tracking should follow (Resolve: reframe/tracking; Premiere: Auto Reframe; CapCut: aspect ratio + auto-reframe; Descript: layout templates). Reference the safe-zone px in the platform playbook.
5. **OBS recording setup.** Scene list (talking-head, screen-capture, overlay), source layout, canvas/output resolution + fps for the target platform (e.g. 1920×1080/30 for long-form, or a 1080×1920 vertical canvas), a mic/levels reminder ("low quality audio is the fastest way to drop a viewer"), and a pre-record checklist (framing in the center-safe zone, hook ready, hotkeys for scene switches).

## Producing files
When the user wants an actual file, write it to disk and deliver with SendUserFile (and, if they want it on their machine, commit it to their connected folder):
- **.srt** — standard SubRip blocks (index, `HH:MM:SS,mmm --> HH:MM:SS,mmm`, text). Imports into Resolve, Premiere, CapCut, and Descript, and uploads to YouTube.
- **Marker .csv** — include a header row and clear timecodes; use Resolve's expected columns if the user is in Resolve, otherwise a clean generic `name,timecode,color,note` layout (or an EDL-style list).
Ask for the frame rate if timecodes matter and it wasn't given (24/30/60), since marker/subtitle timing depends on it.

## Method
1. Get the input: a script (plan the edit forward) or a transcript/raw recording description (plan the cut backward). Ask for length, target platform(s), which editor they use, and fps if needed.
2. Choose the deliverable(s) from the list above based on the ask.
3. Apply the density/energy rules; mark the clippable spikes for Shorts.
4. Output the sheet(s) + any files; note exactly how to import each into the user's editor and OBS.

## Quality bar
Confirm: no dead air survives, a visual beat lands every 1–5s, captions stay inside the safe zone, marker/subtitle timecodes match the stated fps, the import steps match the user's actual editor, and the clip-worthy moments are flagged for repurposing.
