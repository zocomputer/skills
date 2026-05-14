# Text-to-Speech

Use this when generating narration or voiceover for a HyperFrames project.

## Commands

```bash
npx hyperframes tts "Text here" --voice af_nova --output narration.wav
npx hyperframes tts script.txt --voice bf_emma
npx hyperframes tts --list
```

## Workflow

1. Write `SCRIPT.md` first.
2. Generate narration from the approved script.
3. Transcribe the output to get timing:

```bash
npx hyperframes transcribe narration.wav --model medium.en --language en
```

4. Map transcript timings to storyboard beats.
5. Update `STORYBOARD.md` with actual beat durations.
6. Build composition timings from the real audio, not guessed duration.

## Voice choice

Choose voice based on project mood:

- Crisp product demo: clear, neutral voice.
- Cinematic teaser: slower, lower, more space.
- Social ad: faster, hook-oriented, fewer clauses.

If a read sounds rushed, shorten the script before stretching timing. Slow bad copy is still bad copy, merely with more room to disappoint.
