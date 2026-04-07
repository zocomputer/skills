---
name: video-producer
description: End-to-end AI video production pipeline. Takes a brief, generates storyboard, creates scene images/clips via fal-ai, adds voiceover (ElevenLabs/OpenAI TTS), burns in captions, mixes background music, and delivers platform-ready video. Use with the Video Producer persona for a Pexo-like conversational video creation experience.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  persona: Video Producer (a610972e-fb54-43f5-8383-a7b91a4fbd42)
  version: 2.0.0
---
# Video Producer Skill

End-to-end video production from idea to export-ready video.

## Quick Start

```bash
cd /home/workspace/Skills/video-producer/scripts

# Full pipeline — brief to finished video
bun video-producer.ts produce \
  --brief "15-second TikTok ad for tallow balm, punchy hook, natural ingredients angle" \
  --platform tiktok \
  --output /home/workspace/Projects/ffb/05-video/output.mp4

# Individual commands
bun video-producer.ts storyboard --brief "..." --platform tiktok --output storyboard.json
bun video-producer.ts generate --storyboard storyboard.json --output-dir ./scenes/
bun video-producer.ts voiceover --script "Your skin deserves better." --voice Rachel --output vo.mp3
bun video-producer.ts captions --script script.txt --style tiktok-bold --output captions.ass
bun video-producer.ts assemble --scenes ./scenes/ --audio vo.mp3 --music acoustic-warm --captions captions.ass --output final.mp4
bun video-producer.ts optimize --input final.mp4 --platform tiktok --output final-tiktok.mp4
```

## Commands

| Command | Description |
|---------|------------|
| `storyboard` | Generate storyboard JSON from a text brief |
| `generate` | Generate scene images and video clips from storyboard |
| `voiceover` | Generate voiceover audio from script text |
| `captions` | Generate timed ASS/SRT caption file |
| `assemble` | Compose final video from scenes + audio + captions |
| `produce` | Full pipeline: storyboard → generate → voiceover → captions → assemble |
| `optimize` | Re-encode for a specific platform |
| `preview` | Quick low-res preview from scene assets |
| `publish` | Upload to zo.space and publish to TikTok/Facebook/Instagram via Blotato |
| `calendar` | Batch-produce videos from a content calendar markdown file |
| `translate` | Translate storyboard text/voiceover to another language (es, fr, pt, de, ja, zh) |
| `variants` | Generate A/B variant storyboards with different hooks/music/styles |
| `lipsync` | Generate lip-synced talking-head video from face image + audio |
| `analytics` | Pull platform metrics and generate improvement recommendations |

Run `bun video-producer.ts --help` or `bun video-producer.ts <command> --help` for full options.

## Dependencies

- **fal-ai-media skill** — image generation + image-to-video (`FAL_KEY` required in Zo Secrets)
- **elevenlabs-skill** — voiceover generation (`ELEVENLABS_API_KEY` in Zo Secrets, paid plan required)
- **ffmpeg** — video composition, pre-installed on Zo
- **OpenAI TTS** — free voiceover fallback (`OPENAI_API_KEY` in Zo Secrets)
- **OpenAI GPT-4o-mini** — translation for `translate` command (`OPENAI_API_KEY`)
- **Blotato MCP** — social media publishing (`BLOTATO_API_KEY` in env) for publish/analytics commands
- **fal.ai sadtalker/wav2lip** — lip-sync generation for `lipsync` command (`FAL_KEY`)

## Platform Presets

| Platform | Aspect | Resolution | Max Duration |
|----------|--------|------------|-------------|
| tiktok | 9:16 | 1080×1920 | 60s |
| reels | 9:16 | 1080×1920 | 90s |
| youtube-shorts | 9:16 | 1080×1920 | 60s |
| facebook | 4:5 | 1080×1350 | 60s |
| youtube | 16:9 | 1920×1080 | unlimited |

## Character Integration

Use with **ai-character-builder** to apply a character's visual style, voice, and personality to videos:

```bash
# Create a character first
bun /home/workspace/Skills/ai-character-builder/scripts/generate-identity.ts --name "Flora Belle" --output character.json
bun /home/workspace/Skills/ai-character-builder/scripts/generate-avatar.ts --identity character.json
bun /home/workspace/Skills/ai-character-builder/scripts/generate-voice.ts --identity character.json

# Use character in video production — auto-applies style, voice, prompt enrichment
bun video-producer.ts produce --brief "tallow balm ad" --character character.json --platform tiktok

# Character avatar as lip-sync source
bun video-producer.ts lipsync --character character.json --audio voiceover.mp3
```

The `--character` flag is supported on: `produce`, `generate`, `lipsync`

## Assets

- `assets/music/` — Royalty-free background tracks (upbeat-corporate, chill-lofi, cinematic-epic, acoustic-warm)
- `assets/templates/caption-styles/` — ASS subtitle presets (tiktok-bold, minimal-white, brand-ffb)

## Cost Estimate

| Component | Model | Cost (15s video, 4 scenes) |
|-----------|-------|---------------------------|
| Scene images | nano-banana-2 @ $0.04/img | $0.16 |
| Image-to-video | kling-v3-std @ $0.07/sec | ~$1.12 |
| Voiceover | ElevenLabs ~$0.03 | $0.03 |
| Assembly | ffmpeg (local) | $0.00 |
| **Total** | | **~$1.31** |
