# Step 5 — Generate VO and Map Timing

Goal: turn script into real timing.

## Commands

```bash
npx hyperframes tts SCRIPT.md --voice af_nova --output narration.wav
npx hyperframes transcribe narration.wav --model medium.en --language en
```

Use the right voice for the project mood. Check available voices:

```bash
npx hyperframes tts --list
```

## Process

1. Generate narration.
2. Transcribe narration for word-level timing.
3. Map transcript timestamps to storyboard beats.
4. Update `STORYBOARD.md` with actual beat time ranges.
5. Use the real timings for `data-start` and `data-duration`.

## Gate

- `narration.wav` or `.mp3` exists.
- Transcript JSON exists.
- Beat timings in `STORYBOARD.md` are updated.

## Pushback

If the narration runs too long, shorten the script. Do not simply make the video longer unless the user requested a longer format.
