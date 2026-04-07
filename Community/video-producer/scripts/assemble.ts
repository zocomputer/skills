#!/usr/bin/env bun
import { parseArgs } from "util";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join, resolve, basename } from "path";

interface TextOverlay {
  text: string;
  start: number;
  end: number;
  position: "top" | "center" | "bottom";
  fontSize?: number;
}

interface AssembleOptions {
  scenesDir: string;
  audio?: string;
  music?: string;
  musicVolume: number;
  captions?: string;
  transition: "fade" | "dissolve" | "cut";
  transitionDur: number;
  resolution: [number, number];
  fps: number;
  output: string;
  storyboard?: string;
  preview?: boolean;
}

const MUSIC_PRESETS: Record<string, string> = {
  "upbeat-corporate": "/home/workspace/Skills/video-producer/assets/music/upbeat-corporate.mp3",
  "chill-lofi": "/home/workspace/Skills/video-producer/assets/music/chill-lofi.mp3",
  "cinematic-epic": "/home/workspace/Skills/video-producer/assets/music/cinematic-epic.mp3",
  "acoustic-warm": "/home/workspace/Skills/video-producer/assets/music/acoustic-warm.mp3",
};

function run(cmd: string, label?: string): string {
  if (label) console.log(`  [ffmpeg] ${label}`);
  try {
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
  } catch (err: any) {
    const stderr = err.stderr || "";
    console.error(`  [ffmpeg error] ${stderr.slice(-500)}`);
    throw new Error(`ffmpeg failed: ${label || cmd.slice(0, 100)}`);
  }
}

function getMediaDuration(file: string): number {
  const out = run(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${file}"`);
  return parseFloat(out.trim()) || 0;
}

function isVideo(file: string): boolean {
  return /\.(mp4|mov|webm|mkv|avi)$/i.test(file);
}

function isImage(file: string): boolean {
  return /\.(png|jpg|jpeg|webp|bmp)$/i.test(file);
}

type KenBurnsDirection = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down";

const FONT_PATH = "/home/workspace/Skills/video-producer/assets/fonts/Montserrat-Bold.ttf";

function imageToKenBurns(imagePath: string, duration: number, resolution: [number, number], fps: number, outputPath: string, direction?: KenBurnsDirection, textOverlay?: string) {
  const [w, h] = resolution;
  const frames = Math.ceil(duration * fps);
  const dir = direction || (["zoom-in", "zoom-out", "pan-left", "pan-right"] as const)[Math.floor(Math.random() * 4)];

  let zpExpr: string;
  switch (dir) {
    case "zoom-out":
      zpExpr = `z='if(eq(on,1),1.3,max(zoom-0.0015,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
      break;
    case "pan-left":
      zpExpr = `z='1.15':x='iw*0.15-on*(iw*0.15/${frames})':y='ih/2-(ih/zoom/2)'`;
      break;
    case "pan-right":
      zpExpr = `z='1.15':x='on*(iw*0.15/${frames})':y='ih/2-(ih/zoom/2)'`;
      break;
    case "pan-up":
      zpExpr = `z='1.15':x='iw/2-(iw/zoom/2)':y='ih*0.15-on*(ih*0.15/${frames})'`;
      break;
    case "pan-down":
      zpExpr = `z='1.15':x='iw/2-(iw/zoom/2)':y='on*(ih*0.15/${frames})'`;
      break;
    default: // zoom-in
      zpExpr = `z='min(zoom+0.0015,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
  }

  let vf = `scale=${w * 2}:${h * 2},zoompan=${zpExpr}:d=${frames}:s=${w}x${h}:fps=${fps}`;

  if (textOverlay && existsSync(FONT_PATH)) {
    const escaped = textOverlay.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    vf += `,drawtext=fontfile=${FONT_PATH}:text='${escaped}':fontsize=56:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82:enable='between(t,0.5,${duration - 0.5})'`;
  }

  run(
    `ffmpeg -y -loop 1 -i "${imagePath}" -t ${duration} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset fast "${outputPath}"`,
    `Ken Burns (${dir}): ${basename(imagePath)} → ${duration}s${textOverlay ? ` + "${textOverlay.slice(0, 30)}"` : ""}`
  );
}

function normalizeClip(inputPath: string, duration: number, resolution: [number, number], fps: number, outputPath: string, textOverlay?: string) {
  const [w, h] = resolution;
  let vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,fps=${fps}`;

  if (textOverlay && existsSync(FONT_PATH)) {
    const escaped = textOverlay.replace(/'/g, "'\\''").replace(/:/g, "\\:");
    vf += `,drawtext=fontfile=${FONT_PATH}:text='${escaped}':fontsize=56:fontcolor=white:borderw=3:bordercolor=black:x=(w-text_w)/2:y=h*0.82:enable='between(t,0.5,${duration - 0.5})'`;
  }

  run(
    `ffmpeg -y -i "${inputPath}" -t ${duration} -vf "${vf}" -c:v libx264 -pix_fmt yuv420p -preset fast -an "${outputPath}"`,
    `Normalize: ${basename(inputPath)} → ${w}×${h} @ ${fps}fps${textOverlay ? ` + overlay` : ""}`
  );
}

async function concatWithTransitions(clips: string[], transition: string, transitionDur: number, outputPath: string) {
  if (clips.length === 0) throw new Error("No clips to concatenate");

  if (clips.length === 1 || transition === "cut") {
    const listFile = outputPath.replace(/\.[^.]+$/, "_list.txt");
    const listContent = clips.map(c => `file '${c}'`).join("\n");
    await Bun.write(listFile, listContent);
    run(`ffmpeg -y -f concat -safe 0 -i "${listFile}" -c:v libx264 -pix_fmt yuv420p -preset fast "${outputPath}"`, "Concat (cut)");
    try { execSync(`rm "${listFile}"`); } catch {}
    return;
  }

  let filterComplex = "";
  const inputs = clips.map(c => `-i "${c}"`).join(" ");
  let lastOutput = "[0:v]";

  for (let i = 1; i < clips.length; i++) {
    const offset = clips.slice(0, i).reduce((sum, c) => {
      return sum + getMediaDuration(c);
    }, 0) - (transitionDur / 1000) * i;

    const outLabel = i === clips.length - 1 ? "[vout]" : `[v${i}]`;
    filterComplex += `${lastOutput}[${i}:v]xfade=transition=${transition}:duration=${transitionDur / 1000}:offset=${Math.max(0, offset)}${outLabel};`;
    lastOutput = outLabel;
  }

  filterComplex = filterComplex.replace(/;$/, "");

  run(
    `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[vout]" -c:v libx264 -pix_fmt yuv420p -preset fast "${outputPath}"`,
    `Concat with ${transition} transitions`
  );
}

function mixAudio(voiceover: string | undefined, music: string | undefined, musicVolume: number, duration: number, outputPath: string) {
  if (!voiceover && !music) return;

  if (voiceover && music) {
    run(
      `ffmpeg -y -i "${voiceover}" -i "${music}" -filter_complex ` +
      `"[0:a]aresample=44100,loudnorm=I=-16:TP=-1.5:LRA=11[vo];[1:a]aresample=44100,volume=${musicVolume},atrim=0:${duration},afade=t=out:st=${duration - 2}:d=2[bg];[vo][bg]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[aout]" ` +
      `-map "[aout]" -c:a aac -b:a 192k "${outputPath}"`,
      "Mix voiceover + music"
    );
  } else if (voiceover) {
    run(`ffmpeg -y -i "${voiceover}" -af "loudnorm=I=-16:TP=-1.5:LRA=11" -c:a aac -b:a 192k "${outputPath}"`, "Convert voiceover");
  } else if (music) {
    run(
      `ffmpeg -y -i "${music}" -af "volume=${musicVolume},atrim=0:${duration},afade=t=out:st=${duration - 2}:d=2" -c:a aac -b:a 192k "${outputPath}"`,
      "Trim + fade music"
    );
  }
}

function mergeVideoAudio(videoPath: string, audioPath: string | undefined, captionsPath: string | undefined, outputPath: string) {
  let cmd = `ffmpeg -y -i "${videoPath}"`;
  let maps = "-map 0:v";
  let filters = "";

  if (audioPath && existsSync(audioPath)) {
    cmd += ` -i "${audioPath}"`;
    maps += " -map 1:a";
  }

  if (captionsPath && existsSync(captionsPath)) {
    if (captionsPath.endsWith(".ass")) {
      filters = `-vf "ass=${captionsPath}"`;
    } else {
      filters = `-vf "subtitles=${captionsPath}"`;
    }
  }

  cmd += ` ${maps} ${filters} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 192k -movflags +faststart "${outputPath}"`;
  run(cmd, "Final merge: video + audio + captions");
}

function mapCameraToKenBurns(camera?: string): KenBurnsDirection {
  if (!camera) return "zoom-in";
  const c = camera.toLowerCase();
  if (c.includes("zoom out") || c.includes("pull back")) return "zoom-out";
  if (c.includes("pan left") || c.includes("left")) return "pan-left";
  if (c.includes("pan right") || c.includes("right")) return "pan-right";
  if (c.includes("pan up") || c.includes("tilt up") || c.includes("up")) return "pan-up";
  if (c.includes("pan down") || c.includes("tilt down") || c.includes("down")) return "pan-down";
  return "zoom-in";
}

async function assemble(opts: AssembleOptions) {
  const tmpDir = `/tmp/video-producer-${Date.now()}`;
  execSync(`mkdir -p "${tmpDir}"`);

  let storyboardScenes: any[] | null = null;
  if (opts.storyboard && existsSync(opts.storyboard)) {
    try {
      const sb = JSON.parse(await Bun.file(opts.storyboard).text());
      storyboardScenes = sb.scenes || null;
      console.log(`  Loaded storyboard with ${storyboardScenes?.length || 0} scene metadata entries`);
    } catch {}
  }

  const previewFlag = opts.preview ? " (preview mode — low res)" : "";
  const [w, h] = opts.preview ? [Math.round(opts.resolution[0] / 2), Math.round(opts.resolution[1] / 2)] as [number, number] : opts.resolution;
  const effectiveRes: [number, number] = [w, h];

  console.log(`\nAssembling video${previewFlag}...`);
  console.log(`  Scenes dir: ${opts.scenesDir}`);
  console.log(`  Resolution: ${effectiveRes.join("×")}`);
  console.log(`  Transition: ${opts.transition} (${opts.transitionDur}ms)`);

  const sceneFiles = readdirSync(opts.scenesDir)
    .filter(f => isVideo(f) || isImage(f))
    .sort()
    .map(f => join(opts.scenesDir, f));

  if (sceneFiles.length === 0) {
    throw new Error(`No scene files found in ${opts.scenesDir}`);
  }
  console.log(`  Found ${sceneFiles.length} scene files`);

  const normalizedClips: string[] = [];
  for (let i = 0; i < sceneFiles.length; i++) {
    const file = sceneFiles[i];
    const clipPath = join(tmpDir, `clip_${String(i).padStart(3, "0")}.mp4`);

    const sceneMeta = storyboardScenes?.[i];
    const textOverlay = sceneMeta?.text_overlay || undefined;
    const cameraMotion = sceneMeta?.camera_motion;
    const sceneDuration = sceneMeta ? (sceneMeta.end - sceneMeta.start) : undefined;

    if (isImage(file)) {
      const duration = sceneDuration || 4;
      const kbDir = mapCameraToKenBurns(cameraMotion);
      imageToKenBurns(file, duration, effectiveRes, opts.fps, clipPath, kbDir, textOverlay);
    } else {
      const duration = sceneDuration || getMediaDuration(file);
      normalizeClip(file, duration, effectiveRes, opts.fps, clipPath, textOverlay);
    }
    normalizedClips.push(clipPath);
  }

  const concatPath = join(tmpDir, "concat.mp4");
  await concatWithTransitions(normalizedClips, opts.transition, opts.transitionDur, concatPath);

  const totalDuration = getMediaDuration(concatPath);
  console.log(`  Concatenated duration: ${totalDuration.toFixed(1)}s`);

  let musicPath = opts.music;
  if (musicPath && MUSIC_PRESETS[musicPath]) {
    musicPath = MUSIC_PRESETS[musicPath];
  }
  if (musicPath && !existsSync(musicPath)) {
    console.warn(`  Warning: music file not found: ${musicPath}, skipping`);
    musicPath = undefined;
  }

  let audioPath: string | undefined;
  if (opts.audio || musicPath) {
    audioPath = join(tmpDir, "mixed_audio.aac");
    mixAudio(opts.audio, musicPath, opts.musicVolume, totalDuration, audioPath);
  }

  const outputPath = resolve(opts.output);
  mergeVideoAudio(concatPath, audioPath, opts.captions, outputPath);

  execSync(`rm -rf "${tmpDir}"`);

  const finalDuration = getMediaDuration(outputPath);
  const fileSize = Bun.file(outputPath).size;
  console.log(`\nDone! Output: ${outputPath}`);
  console.log(`  Duration: ${finalDuration.toFixed(1)}s`);
  console.log(`  Size: ${(fileSize / 1024 / 1024).toFixed(1)}MB`);
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      scenes: { type: "string" },
      audio: { type: "string" },
      music: { type: "string" },
      "music-volume": { type: "string", default: "0.15" },
      captions: { type: "string" },
      transition: { type: "string", default: "fade" },
      "transition-dur": { type: "string", default: "500" },
      resolution: { type: "string", default: "1080x1920" },
      fps: { type: "string", default: "30" },
      storyboard: { type: "string" },
      preview: { type: "boolean", default: false },
      output: { type: "string", default: "output.mp4" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals[0] === "help") {
    console.log(`
Usage: bun assemble.ts [options]

Compose a final video from scene files, audio, and captions using ffmpeg.

Options:
  --scenes <dir>          Directory containing scene files (images/videos, sorted alphabetically) (required)
  --audio <file>          Voiceover audio file
  --music <file|preset>   Background music file or preset (upbeat-corporate|chill-lofi|cinematic-epic|acoustic-warm)
  --music-volume <float>  Music volume 0.0–1.0 (default: 0.15)
  --captions <file>       ASS or SRT caption file to burn in
  --transition <type>     Transition: fade|dissolve|cut (default: fade)
  --transition-dur <ms>   Transition duration in ms (default: 500)
  --resolution <WxH>      Output resolution (default: 1080x1920)
  --fps <n>               Frames per second (default: 30)
  --storyboard <file>     Storyboard JSON for per-scene metadata (text overlays, camera motion, durations)
  --preview               Generate at half resolution for quick preview
  --output <file>         Output video path (default: output.mp4)
  --help                  Show this help

Scene files are processed in alphabetical order. Images get a Ken Burns effect with variable
zoom/pan directions (from storyboard camera_motion or randomized). Text overlays from the
storyboard are burned into each scene. Videos are normalized to the target resolution.

Example:
  bun assemble.ts --scenes ./scenes/ --audio voiceover.mp3 --music acoustic-warm --captions captions.ass --output final.mp4
`);
    process.exit(0);
  }

  if (!values.scenes) {
    console.error("Error: --scenes directory is required");
    process.exit(1);
  }

  const [w, h] = values.resolution!.split("x").map(Number) as [number, number];

  await assemble({
    scenesDir: resolve(values.scenes!),
    audio: values.audio ? resolve(values.audio) : undefined,
    music: values.music,
    musicVolume: parseFloat(values["music-volume"]!),
    captions: values.captions ? resolve(values.captions) : undefined,
    transition: values.transition as "fade" | "dissolve" | "cut",
    transitionDur: parseInt(values["transition-dur"]!, 10),
    resolution: [w, h],
    fps: parseInt(values.fps!, 10),
    storyboard: values.storyboard ? resolve(values.storyboard) : undefined,
    preview: values.preview,
    output: values.output!,
  });
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
