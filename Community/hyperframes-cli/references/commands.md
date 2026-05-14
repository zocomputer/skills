# HyperFrames Commands

## Init

```bash
npx hyperframes init my-video
npx hyperframes init my-video --example warm-grain
npx hyperframes init my-video --video clip.mp4
npx hyperframes init my-video --audio track.mp3
npx hyperframes init my-video --non-interactive
```

Examples: `blank`, `warm-grain`, `play-mode`, `swiss-grid`, `vignelli`, `decision-tree`, `kinetic-type`, `product-promo`, `nyt-graph`.

## Lint

```bash
npx hyperframes lint
npx hyperframes lint ./my-project
npx hyperframes lint --verbose
npx hyperframes lint --json
```

## Validate

```bash
npx hyperframes validate
npx hyperframes validate --no-contrast
```

Use `--no-contrast` only during rapid iteration.

## Inspect

```bash
npx hyperframes inspect
npx hyperframes inspect ./my-project
npx hyperframes inspect --json
npx hyperframes inspect --samples 15
npx hyperframes inspect --at 1.5,4,7.25
```

`npx hyperframes layout` is an alias.

## Preview

```bash
npx hyperframes preview
npx hyperframes preview --port 4567
```

Handoff URL:

```text
http://localhost:<port>/#project/<project-name>
```

## Render

```bash
npx hyperframes render
npx hyperframes render --output final.mp4
npx hyperframes render --quality draft
npx hyperframes render --fps 60 --quality high
npx hyperframes render --format webm
npx hyperframes render --docker
npx hyperframes render --gpu
npx hyperframes render --strict
npx hyperframes render --strict-all
```

Flags:

| Flag | Options | Default | Notes |
|---|---|---|---|
| `--output` | path | `renders/name_timestamp.mp4` | Output path |
| `--fps` | 24, 30, 60 | 30 | 60fps doubles render time |
| `--quality` | draft, standard, high | standard | draft for iteration |
| `--format` | mp4, webm | mp4 | WebM supports transparency |
| `--workers` | 1-8 or auto | auto | Each spawns Chrome |
| `--docker` | flag | off | Reproducible output |
| `--gpu` | flag | off | GPU encoding |
| `--strict` | flag | off | Fail on lint errors |
| `--strict-all` | flag | off | Fail on errors and warnings |

## Transcribe and TTS

```bash
npx hyperframes transcribe audio.mp3
npx hyperframes transcribe video.mp4 --model medium.en --language en
npx hyperframes transcribe subtitles.srt
npx hyperframes transcribe subtitles.vtt
npx hyperframes transcribe openai-response.json

npx hyperframes tts "Text here" --voice af_nova --output narration.wav
npx hyperframes tts script.txt --voice bf_emma
npx hyperframes tts --list
```

## Troubleshooting

```bash
npx hyperframes doctor
npx hyperframes browser
npx hyperframes info
npx hyperframes upgrade
npx hyperframes compositions
npx hyperframes docs
npx hyperframes benchmark .
```
