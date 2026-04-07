#!/usr/bin/env bun
import { parseArgs } from "util";
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync } from "fs";
import { join, resolve, dirname } from "path";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const FAL_MEDIA = "/home/workspace/Skills/fal-ai-media/scripts/fal-media.ts";
const ELEVENLABS = "/home/workspace/Skills/elevenlabs-skill/scripts/elevenlabs.ts";
const CHARACTER_BUILDER = "/home/workspace/Skills/ai-character-builder/scripts";

interface CharacterIdentity {
  id: string;
  name: string;
  niche: string;
  audience: string;
  backstory: string;
  values: string[];
  personality: { tone: string; humor: string; formality: string };
  visual: { style: string; age_range: string; aesthetic: string };
  prompts: { midjourney: string; stable_diffusion: string };
}

interface CharacterVoice {
  provider: string;
  recommended_voices: { name: string; id: string; reason: string }[];
  settings: { stability: number; similarity_boost: number; style: number; speed: number };
  voice_profile: { gender: string; age_range: string; accent: string; tone_qualities: string[] };
}

interface CharacterPack {
  identity: CharacterIdentity;
  voice?: CharacterVoice;
  avatarPath?: string;
}

async function loadCharacter(characterPath: string): Promise<CharacterPack> {
  const absPath = resolve(characterPath);
  if (!existsSync(absPath)) {
    throw new Error(`Character file not found: ${absPath}`);
  }

  const identity: CharacterIdentity = JSON.parse(await Bun.file(absPath).text());
  const dir = dirname(absPath);
  const pack: CharacterPack = { identity };

  // Auto-detect companion files: voice config and avatar
  const voicePath = join(dir, `${identity.id}-voice.json`);
  const voiceAltPath = absPath.replace(/\.json$/, "-voice.json");
  if (existsSync(voicePath)) {
    pack.voice = JSON.parse(await Bun.file(voicePath).text());
  } else if (existsSync(voiceAltPath)) {
    pack.voice = JSON.parse(await Bun.file(voiceAltPath).text());
  }

  // Look for avatar image
  for (const ext of ["png", "jpg", "jpeg", "webp"]) {
    const avatarPath = join(dir, `${identity.id}-avatar.${ext}`);
    const avatarAlt = absPath.replace(/\.json$/, `-avatar.${ext}`);
    if (existsSync(avatarPath)) { pack.avatarPath = avatarPath; break; }
    if (existsSync(avatarAlt)) { pack.avatarPath = avatarAlt; break; }
  }

  console.log(`  Character loaded: ${identity.name}`);
  console.log(`    Niche: ${identity.niche}`);
  console.log(`    Visual: ${identity.visual.style}, ${identity.visual.aesthetic}`);
  if (pack.voice) console.log(`    Voice: ${pack.voice.recommended_voices?.[0]?.name || pack.voice.voice_profile.gender}`);
  if (pack.avatarPath) console.log(`    Avatar: ${pack.avatarPath}`);

  return pack;
}

const PLATFORM_PRESETS: Record<string, { aspect: string; resolution: string; aspectFlag: string }> = {
  tiktok: { aspect: "9:16", resolution: "1080x1920", aspectFlag: "--aspect-ratio 9:16" },
  reels: { aspect: "9:16", resolution: "1080x1920", aspectFlag: "--aspect-ratio 9:16" },
  "youtube-shorts": { aspect: "9:16", resolution: "1080x1920", aspectFlag: "--aspect-ratio 9:16" },
  facebook: { aspect: "4:5", resolution: "1080x1350", aspectFlag: "--width 1080 --height 1350" },
  youtube: { aspect: "16:9", resolution: "1920x1080", aspectFlag: "--aspect-ratio 16:9" },
};

function run(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024, timeout: 300_000 });
  } catch (err: any) {
    throw new Error(err.stderr?.slice(-500) || err.message);
  }
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

async function cmdStoryboard(args: string[]) {
  const result = run(`bun "${join(SCRIPT_DIR, "storyboard.ts")}" ${args.join(" ")}`);
  console.log(result);
}

async function cmdGenerate(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      storyboard: { type: "string" },
      model: { type: "string", default: "nano-banana-2" },
      "video-model": { type: "string", default: "kling-v3-std" },
      style: { type: "string" },
      "output-dir": { type: "string", default: "./scenes" },
      "skip-video": { type: "boolean", default: false },
      character: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.storyboard) {
    console.error("Error: --storyboard is required");
    process.exit(1);
  }

  const storyboard = JSON.parse(await Bun.file(resolve(values.storyboard!)).text());
  const outDir = resolve(values["output-dir"]!);
  ensureDir(outDir);

  // Load character for prompt enrichment
  let character: CharacterPack | null = null;
  if (values.character) {
    character = await loadCharacter(values.character);
  }

  console.log(`Generating assets for ${storyboard.scenes.length} scenes...`);
  console.log(`  Image model: ${values.model}`);
  console.log(`  Video model: ${values["video-model"]}`);
  if (character) console.log(`  Character: ${character.identity.name}`);
  console.log(`  Output: ${outDir}`);

  const preset = PLATFORM_PRESETS[storyboard.platform] || PLATFORM_PRESETS.tiktok;

  for (const scene of storyboard.scenes) {
    const sceneId = String(scene.id).padStart(3, "0");
    const imagePath = join(outDir, `scene_${sceneId}.png`);
    const videoPath = join(outDir, `scene_${sceneId}.mp4`);

    if (scene.type === "user-asset") {
      console.log(`  Scene ${scene.id}: using user asset (skip)`);
      continue;
    }

    let prompt = scene.prompt;
    if (values.style) {
      prompt = `${prompt}, ${values.style}`;
    }
    if (storyboard.style) {
      prompt = `${prompt}, ${storyboard.style}`;
    }
    if (character) {
      const v = character.identity.visual;
      prompt = `${prompt}, ${v.style}, ${v.aesthetic}`;
    }

    console.log(`\n  Scene ${scene.id}: generating image...`);
    try {
      const imgResult = run(
        `bun "${FAL_MEDIA}" generate --prompt "${prompt.replace(/"/g, '\\"')}" --model ${values.model} ${preset.aspectFlag} --output "${imagePath}"`
      );
      console.log(`    Image saved: ${imagePath}`);
    } catch (err: any) {
      console.error(`    Image generation failed: ${err.message}`);
      continue;
    }

    if (!values["skip-video"] && (scene.type === "image-to-video" || scene.type === "text-to-video")) {
      const duration = scene.end - scene.start;
      const motionPrompt = scene.camera_motion ? `${scene.camera_motion}, ` : "";
      console.log(`  Scene ${scene.id}: generating video clip (${duration}s)...`);
      try {
        const vidResult = run(
          `bun "${FAL_MEDIA}" video --prompt "${motionPrompt}${scene.description.replace(/"/g, '\\"')}" --image "${imagePath}" --model ${values["video-model"]} --output "${videoPath}"`
        );
        console.log(`    Video saved: ${videoPath}`);
      } catch (err: any) {
        console.error(`    Video generation failed: ${err.message}`);
        console.log(`    Falling back to image (will use Ken Burns in assembly)`);
      }
    }
  }

  const generatedFiles = readdirSync(outDir).filter(f => f.startsWith("scene_"));
  console.log(`\nGeneration complete. ${generatedFiles.length} files in ${outDir}`);
}

async function cmdVoiceover(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      script: { type: "string" },
      voice: { type: "string", default: "Rachel" },
      engine: { type: "string", default: "elevenlabs" },
      speed: { type: "string", default: "1.0" },
      output: { type: "string", default: "voiceover.mp3" },
    },
    allowPositionals: false,
  });

  if (!values.script) {
    console.error("Error: --script is required");
    process.exit(1);
  }

  let scriptText = values.script!;
  if (existsSync(scriptText)) {
    scriptText = await Bun.file(scriptText).text();
  }

  const outputPath = resolve(values.output!);
  ensureDir(dirname(outputPath));

  console.log(`Generating voiceover...`);
  console.log(`  Engine: ${values.engine}`);
  console.log(`  Voice: ${values.voice}`);
  console.log(`  Script: "${scriptText.slice(0, 80)}..."`);

  if (values.engine === "elevenlabs") {
    try {
      const result = run(
        `bun "${ELEVENLABS}" speak "${scriptText.replace(/"/g, '\\"')}" --voice ${values.voice} --output "${outputPath}"`
      );
      if (result.includes("error") || result.includes("❌") || !existsSync(outputPath) || Bun.file(outputPath).size < 100) {
        throw new Error(result.trim().slice(-200));
      }
      console.log(result);
    } catch (err: any) {
      console.warn(`  ElevenLabs failed: ${err.message.slice(0, 150)}`);
      console.log(`  Falling back to OpenAI TTS...`);
      values.engine = "openai-tts";
    }
  }

  if (values.engine === "openai-tts") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("  Error: OPENAI_API_KEY not set. Add it in Zo Settings > Advanced > Secrets.");
      process.exit(1);
    }
    const voiceMap: Record<string, string> = {
      Rachel: "nova", Bella: "shimmer", Antoni: "onyx", Josh: "echo", Sam: "alloy", Grace: "fable",
    };
    const openaiVoice = voiceMap[values.voice!] || "nova";
    run(
      `curl -s https://api.openai.com/v1/audio/speech ` +
      `-H "Authorization: Bearer ${apiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '${JSON.stringify({ model: "tts-1", input: scriptText, voice: openaiVoice, speed: parseFloat(values.speed!) })}' ` +
      `--output "${outputPath}"`
    );
  }

  if (existsSync(outputPath)) {
    const size = Bun.file(outputPath).size;
    console.log(`\nVoiceover saved: ${outputPath} (${(size / 1024).toFixed(0)}KB)`);
  }
}

async function cmdCaptions(args: string[]) {
  const result = run(`bun "${join(SCRIPT_DIR, "captions.ts")}" ${args.join(" ")}`);
  console.log(result);
}

async function cmdAssemble(args: string[]) {
  const result = run(`bun "${join(SCRIPT_DIR, "assemble.ts")}" ${args.join(" ")}`);
  console.log(result);
}

async function cmdOptimize(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      input: { type: "string" },
      platform: { type: "string", default: "tiktok" },
      output: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  const preset = PLATFORM_PRESETS[values.platform!] || PLATFORM_PRESETS.tiktok;
  const [w, h] = preset.resolution.split("x");
  const outputPath = values.output || values.input!.replace(/\.[^.]+$/, `-${values.platform}.mp4`);

  console.log(`Optimizing for ${values.platform}...`);
  run(
    `ffmpeg -y -i "${resolve(values.input!)}" ` +
    `-vf "scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black" ` +
    `-c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k -movflags +faststart "${resolve(outputPath)}"`
  );
  console.log(`Optimized: ${resolve(outputPath)}`);
}

async function cmdProduce(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      brief: { type: "string" },
      platform: { type: "string", default: "tiktok" },
      duration: { type: "string", default: "15" },
      "voiceover-script": { type: "string" },
      voice: { type: "string", default: "Rachel" },
      "voice-engine": { type: "string", default: "elevenlabs" },
      music: { type: "string", default: "acoustic-warm" },
      "music-volume": { type: "string", default: "0.15" },
      "caption-style": { type: "string", default: "tiktok-bold" },
      "image-model": { type: "string", default: "nano-banana-2" },
      "video-model": { type: "string", default: "kling-v3-std" },
      style: { type: "string" },
      transition: { type: "string", default: "fade" },
      "skip-video": { type: "boolean", default: false },
      character: { type: "string" },
      output: { type: "string" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage: bun video-producer.ts produce [options]

Full pipeline: brief → storyboard → generate → voiceover → captions → assemble

Options:
  --brief <text>            Video idea (required)
  --platform <name>         tiktok|reels|youtube-shorts|facebook|youtube (default: tiktok)
  --duration <sec>          Target duration (default: 15)
  --voiceover-script <text> Voiceover text (default: extracted from storyboard)
  --voice <name>            Voice: Rachel|Bella|Antoni|Josh|Sam|Grace (default: Rachel)
  --voice-engine <name>     elevenlabs|openai-tts (default: elevenlabs)
  --music <preset|file>     Music track (default: acoustic-warm)
  --music-volume <float>    Music volume 0.0-1.0 (default: 0.15)
  --caption-style <name>    tiktok-bold|minimal-white|brand-ffb (default: tiktok-bold)
  --image-model <name>      Image gen model (default: nano-banana-2)
  --video-model <name>      Video gen model (default: kling-v3-std)
  --style <text>            Global style addition to prompts
  --transition <type>       fade|dissolve|cut (default: fade)
  --skip-video              Generate images only (Ken Burns in assembly)
  --character <file>        AI character identity JSON (from ai-character-builder)
  --output <file>           Final output path
`);
    process.exit(0);
  }

  if (!values.brief) {
    console.error("Error: --brief is required");
    process.exit(1);
  }

  // Load character if specified — applies visual style, voice, and prompt enrichment
  let character: CharacterPack | null = null;
  if (values.character) {
    console.log("Loading AI character...");
    character = await loadCharacter(values.character);

    // Apply character visual style if no explicit --style
    if (!values.style && character.identity.visual) {
      values.style = `${character.identity.visual.style}, ${character.identity.visual.aesthetic}`;
    }

    // Apply character voice if no explicit --voice
    if (character.voice?.recommended_voices?.length && values.voice === "Rachel") {
      values.voice = character.voice.recommended_voices[0].name;
      // Map character voice gender to OpenAI TTS voice for fallback
      if (character.voice.voice_profile?.gender === "male") {
        values.voice = "Josh"; // maps to echo in OpenAI
      }
    }

    // Enrich brief with character context
    const charContext = `Character: ${character.identity.name} (${character.identity.niche}). Tone: ${character.identity.personality.tone}. Audience: ${character.identity.audience}.`;
    values.brief = `${values.brief}. ${charContext}`;
    console.log("");
  }

  const preset = PLATFORM_PRESETS[values.platform!] || PLATFORM_PRESETS.tiktok;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const projectDir = `/tmp/video-producer-${timestamp}`;
  ensureDir(projectDir);

  const storyboardPath = join(projectDir, "storyboard.json");
  const scenesDir = join(projectDir, "scenes");
  const voiceoverPath = join(projectDir, "voiceover.mp3");
  const captionsPath = join(projectDir, "captions.ass");
  const outputPath = values.output ? resolve(values.output) : join(projectDir, "final.mp4");
  ensureDir(scenesDir);
  ensureDir(dirname(outputPath));

  console.log("═══════════════════════════════════════");
  console.log("  VIDEO PRODUCER — Full Pipeline");
  console.log("═══════════════════════════════════════");
  console.log(`  Brief: ${values.brief}`);
  console.log(`  Platform: ${values.platform} (${preset.aspect})`);
  console.log(`  Duration: ${values.duration}s`);
  console.log(`  Project: ${projectDir}`);
  console.log("");

  console.log("── Step 1/5: Storyboard ──");
  await cmdStoryboard([
    "--brief", `"${values.brief!.replace(/"/g, '\\"')}"`,
    "--platform", values.platform!,
    "--duration", values.duration!,
    "--output", storyboardPath,
  ]);

  console.log("\n── Step 2/5: Generate Scene Assets ──");
  const genArgs = [
    "--storyboard", storyboardPath,
    "--model", values["image-model"]!,
    "--video-model", values["video-model"]!,
    "--output-dir", scenesDir,
  ];
  if (values.style) genArgs.push("--style", values.style);
  if (values["skip-video"]) genArgs.push("--skip-video");
  if (values.character) genArgs.push("--character", values.character);
  await cmdGenerate(genArgs);

  const storyboard = JSON.parse(await Bun.file(storyboardPath).text());
  const voScript = values["voiceover-script"] || storyboard.voiceover_script || "";

  if (voScript) {
    console.log("\n── Step 3/5: Voiceover ──");
    await cmdVoiceover([
      "--script", `"${voScript.replace(/"/g, '\\"')}"`,
      "--voice", values.voice!,
      "--engine", values["voice-engine"]!,
      "--output", voiceoverPath,
    ]);
  } else {
    console.log("\n── Step 3/5: Voiceover (skipped — no script) ──");
  }

  if (voScript) {
    console.log("\n── Step 4/5: Captions ──");
    await cmdCaptions([
      "--script", `"${voScript.replace(/"/g, '\\"')}"`,
      "--duration", values.duration!,
      "--style", values["caption-style"]!,
      "--resolution", preset.resolution,
      "--output", captionsPath,
    ]);
  } else {
    console.log("\n── Step 4/5: Captions (skipped — no script) ──");
  }

  console.log("\n── Step 5/5: Assembly ──");
  const assembleArgs = [
    "--scenes", scenesDir,
    "--transition", values.transition!,
    "--resolution", preset.resolution,
    "--storyboard", storyboardPath,
    "--output", outputPath,
  ];
  if (voScript && existsSync(voiceoverPath)) assembleArgs.push("--audio", voiceoverPath);
  if (values.music) assembleArgs.push("--music", values.music);
  assembleArgs.push("--music-volume", values["music-volume"]!);
  if (voScript && existsSync(captionsPath)) assembleArgs.push("--captions", captionsPath);
  await cmdAssemble(assembleArgs);

  console.log("\n═══════════════════════════════════════");
  console.log("  PRODUCTION COMPLETE");
  console.log("═══════════════════════════════════════");
  console.log(`  Output: ${outputPath}`);
  console.log(`  Storyboard: ${storyboardPath}`);
  console.log(`  Project dir: ${projectDir}`);
}

async function cmdPreview(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      scenes: { type: "string" },
      storyboard: { type: "string" },
      music: { type: "string" },
      captions: { type: "string" },
      output: { type: "string", default: "/tmp/preview.mp4" },
    },
    allowPositionals: false,
  });

  if (!values.scenes) {
    console.error("Error: --scenes is required");
    process.exit(1);
  }

  console.log("Generating quick preview (half resolution, no voiceover)...");
  const assembleArgs = [
    "--scenes", values.scenes!,
    "--transition", "cut",
    "--resolution", "540x960",
    "--preview",
    "--output", values.output!,
  ];
  if (values.storyboard) assembleArgs.push("--storyboard", values.storyboard);
  if (values.music) assembleArgs.push("--music", values.music);
  if (values.captions) assembleArgs.push("--captions", values.captions);
  await cmdAssemble(assembleArgs);
  console.log(`Preview: ${resolve(values.output!)}`);
}

// --- Phase 3: Publish & Calendar ---

const BLOTATO_ENDPOINT = "https://mcp.blotato.com/mcp";
const PLATFORM_ACCOUNTS: Record<string, { accountId: number; platform: string; pageId?: number }> = {
  tiktok: { accountId: 32615, platform: "tiktok" },
  facebook: { accountId: 15022, platform: "facebook", pageId: 1024978054029301 },
  instagram: { accountId: 23997, platform: "instagram" },
};

async function cmdPublish(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      video: { type: "string" },
      platform: { type: "string", default: "tiktok" },
      caption: { type: "string", default: "" },
      hashtags: { type: "string", default: "" },
    },
    allowPositionals: false,
  });

  if (!values.video || !existsSync(values.video!)) {
    console.error("Error: --video must point to an existing .mp4 file");
    process.exit(1);
  }

  const platform = values.platform!.toLowerCase();
  const account = PLATFORM_ACCOUNTS[platform];
  if (!account) {
    console.error(`Error: unsupported platform '${platform}'. Choose: ${Object.keys(PLATFORM_ACCOUNTS).join(", ")}`);
    process.exit(1);
  }

  const videoPath = resolve(values.video!);
  const filename = `video-producer/${Date.now()}-${platform}.mp4`;

  // Step 1: Upload to zo.space
  console.log(`Uploading ${videoPath} to zo.space as ${filename}...`);
  const uploadCmd = `cat <<'PYEOF' | python3 -
import subprocess, json, sys
result = subprocess.run(
    ["zo", "update-space-asset", "--path", "${filename}", "--local-file", "${videoPath}"],
    capture_output=True, text=True, timeout=120
)
if result.returncode != 0:
    print(f"Upload failed: {result.stderr}", file=sys.stderr)
    sys.exit(1)
print(result.stdout.strip())
PYEOF`;

  // Use zo run_bash_command for the upload since it needs zo.space access
  const assetUrl = `https://marlandoj.zo.space/${filename}`;
  console.log(`Asset URL: ${assetUrl}`);

  // Step 2: Build Blotato post body
  const captionText = [values.caption || "", values.hashtags || ""].filter(Boolean).join("\n\n");

  let postBody: any;
  if (platform === "tiktok") {
    postBody = {
      accountId: account.accountId,
      text: captionText,
      mediaUrls: [assetUrl],
      privacyLevel: "SELF_ONLY",
      disabledComments: false,
      disabledDuet: false,
      disabledStitch: false,
      isBrandedContent: false,
      isYourBrand: false,
      isAiGenerated: true,
    };
  } else if (platform === "facebook") {
    postBody = {
      accountId: account.accountId,
      pageId: account.pageId,
      text: captionText,
      mediaUrls: [assetUrl],
    };
  } else {
    // instagram
    postBody = {
      accountId: account.accountId,
      text: captionText,
      mediaUrls: [assetUrl],
    };
  }

  // Step 3: Post via Blotato MCP
  console.log(`Publishing to ${platform}...`);
  const blotatoPayload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: `create_${platform === "facebook" ? "facebook_page" : platform}_post`,
      arguments: postBody,
    },
  });

  const curlCmd = `curl -s -X POST "${BLOTATO_ENDPOINT}" \
    -H "Content-Type: application/json" \
    -H "blotato-api-key: $BLOTATO_API_KEY" \
    -d '${blotatoPayload.replace(/'/g, "'\\''")}'`;

  try {
    const result = run(curlCmd);
    const parsed = JSON.parse(result);
    if (parsed.error) {
      console.error(`Blotato error: ${JSON.stringify(parsed.error)}`);
      process.exit(1);
    }
    console.log(`Published to ${platform}!`);
    console.log(`Response: ${JSON.stringify(parsed.result || parsed, null, 2).slice(0, 500)}`);
  } catch (err: any) {
    console.error(`Publish failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdCalendar(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      calendar: { type: "string", default: "/home/workspace/FFBSourceFiles/social/30-DAY-CONTENT-CALENDAR.md" },
      "project-dir": { type: "string", default: "/tmp/video-producer-calendar" },
      platform: { type: "string", default: "tiktok" },
      "dry-run": { type: "boolean", default: false },
      day: { type: "string" },
    },
    allowPositionals: false,
  });

  const calendarPath = values.calendar!;
  if (!existsSync(calendarPath)) {
    console.error(`Error: calendar file not found: ${calendarPath}`);
    process.exit(1);
  }

  const calendarContent = await Bun.file(calendarPath).text();

  // Parse markdown table rows: | # | Platform | Type | Pillar | Content | Status |
  const rows = calendarContent
    .split("\n")
    .filter(line => /^\|/.test(line) && !/^[\|\s-]+$/.test(line))
    .slice(1); // skip header

  interface CalEntry {
    day: string;
    platform: string;
    type: string;
    pillar: string;
    content: string;
    status: string;
  }

  const entries: CalEntry[] = rows.map(row => {
    const cols = row.split("|").map(c => c.trim()).filter(Boolean);
    return {
      day: cols[0] || "",
      platform: cols[1] || "",
      type: cols[2] || "",
      pillar: cols[3] || "",
      content: cols[4] || "",
      status: cols[5] || "",
    };
  });

  // Filter for video-type entries
  const videoEntries = entries.filter(e =>
    /video|reel|tiktok|clip/i.test(e.type) || /video|reel/i.test(e.content)
  );

  // Filter by specific day if requested
  const targetEntries = values.day
    ? videoEntries.filter(e => e.day === values.day)
    : videoEntries;

  console.log(`Found ${videoEntries.length} video entries in calendar, processing ${targetEntries.length}`);

  if (targetEntries.length === 0) {
    console.log("No video entries to process.");
    return;
  }

  const projectDir = values["project-dir"]!;
  ensureDir(projectDir);

  for (const entry of targetEntries) {
    console.log(`\n--- Day ${entry.day}: ${entry.content.slice(0, 60)}... ---`);

    if (values["dry-run"]) {
      console.log(`  [DRY RUN] Would produce: platform=${entry.platform || values.platform}, type=${entry.type}, content="${entry.content.slice(0, 80)}"`);
      continue;
    }

    const dayDir = join(projectDir, `day-${entry.day}`);
    ensureDir(dayDir);

    // Run the full produce pipeline for this entry
    const brief = `Create a ${entry.type || "video"} for ${entry.platform || values.platform} about: ${entry.content}. Brand: Fauna & Flora Botanicals. Pillar: ${entry.pillar}`;
    const platform = (entry.platform || values.platform!).toLowerCase().replace(/\s/g, "");

    try {
      await cmdProduce([
        "--brief", brief,
        "--platform", platform.includes("tiktok") ? "tiktok" : platform.includes("youtube") ? "youtube" : "tiktok",
        "--duration", "15",
        "--output", join(dayDir, `day${entry.day}-${platform}.mp4`),
      ]);
      console.log(`  Day ${entry.day} complete!`);
    } catch (err: any) {
      console.error(`  Day ${entry.day} failed: ${err.message}`);
    }
  }

  console.log(`\nCalendar batch complete. Output: ${projectDir}`);
}

// --- Phase 4: Multi-language, A/B Variants, Analytics, Lip-sync ---

const SUPPORTED_LANGUAGES: Record<string, { code: string; voiceMap: Record<string, string> }> = {
  en: { code: "en", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  es: { code: "es", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  fr: { code: "fr", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  pt: { code: "pt", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  de: { code: "de", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  ja: { code: "ja", voiceMap: { default: "nova", male: "echo", female: "nova" } },
  zh: { code: "zh", voiceMap: { default: "nova", male: "echo", female: "nova" } },
};

async function cmdTranslate(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      storyboard: { type: "string" },
      lang: { type: "string" },
      output: { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.storyboard || !values.lang) {
    console.error("Error: --storyboard and --lang are required");
    console.error("Supported languages: " + Object.keys(SUPPORTED_LANGUAGES).join(", "));
    process.exit(1);
  }

  const lang = values.lang!.toLowerCase();
  if (!SUPPORTED_LANGUAGES[lang]) {
    console.error(`Error: unsupported language '${lang}'. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(", ")}`);
    process.exit(1);
  }

  const sbPath = resolve(values.storyboard!);
  const storyboard = JSON.parse(await Bun.file(sbPath).text());
  const outputPath = values.output || sbPath.replace(/\.json$/, `-${lang}.json`);

  console.log(`Translating storyboard to ${lang}...`);

  // Use OpenAI for translation
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY required for translation");
    process.exit(1);
  }

  // Collect all translatable text
  const textsToTranslate: string[] = [];
  textsToTranslate.push(storyboard.title || "");
  textsToTranslate.push(storyboard.voiceover_script || "");
  for (const scene of storyboard.scenes) {
    textsToTranslate.push(scene.text_overlay || "");
    textsToTranslate.push(scene.voiceover || "");
  }

  const translationPrompt = `Translate the following texts to ${lang}. Return a JSON array of translated strings in the same order. Keep brand names unchanged. Input:\n${JSON.stringify(textsToTranslate)}`;

  try {
    const result = run(
      `curl -s https://api.openai.com/v1/chat/completions ` +
      `-H "Authorization: Bearer ${apiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '${JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: translationPrompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }).replace(/'/g, "'\\''")}'`
    );

    const parsed = JSON.parse(result);
    const content = parsed.choices?.[0]?.message?.content || "{}";
    let translations: string[];
    const contentParsed = JSON.parse(content);
    translations = Array.isArray(contentParsed) ? contentParsed : contentParsed.translations || contentParsed.translated || Object.values(contentParsed);

    if (translations.length !== textsToTranslate.length) {
      console.warn(`  Warning: got ${translations.length} translations for ${textsToTranslate.length} inputs, padding...`);
      while (translations.length < textsToTranslate.length) translations.push(textsToTranslate[translations.length]);
    }

    // Apply translations back
    let idx = 0;
    storyboard.title = translations[idx++] || storyboard.title;
    storyboard.voiceover_script = translations[idx++] || storyboard.voiceover_script;
    for (const scene of storyboard.scenes) {
      if (scene.text_overlay) scene.text_overlay = translations[idx] || scene.text_overlay;
      idx++;
      if (scene.voiceover) scene.voiceover = translations[idx] || scene.voiceover;
      idx++;
    }

    storyboard._lang = lang;
    if (storyboard._version) {
      storyboard._version.timestamp = new Date().toISOString();
    }

    await Bun.write(outputPath, JSON.stringify(storyboard, null, 2));
    console.log(`Translated storyboard saved: ${outputPath}`);
    console.log(`  Language: ${lang}`);
    console.log(`  Translated ${textsToTranslate.filter(Boolean).length} text fields`);
  } catch (err: any) {
    console.error(`Translation failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdVariants(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      storyboard: { type: "string" },
      count: { type: "string", default: "2" },
      vary: { type: "string", default: "hook,music,style" },
      "output-dir": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    allowPositionals: false,
  });

  if (!values.storyboard) {
    console.error("Error: --storyboard is required");
    process.exit(1);
  }

  const sbPath = resolve(values.storyboard!);
  const storyboard = JSON.parse(await Bun.file(sbPath).text());
  const variantCount = parseInt(values.count!, 10);
  const varyFields = values.vary!.split(",").map(s => s.trim());
  const outDir = values["output-dir"] || dirname(sbPath);
  ensureDir(outDir);

  console.log(`Generating ${variantCount} A/B variants...`);
  console.log(`  Varying: ${varyFields.join(", ")}`);

  const hookVariations = [
    "dramatic, high-contrast, bold text hook",
    "soft, warm, question-based hook",
    "urgent, time-sensitive, FOMO hook",
    "educational, fact-based hook",
    "emotional, storytelling hook",
  ];

  const musicVariations = ["acoustic-warm", "upbeat-corporate", "chill-lofi", "cinematic-epic"];

  const styleVariations = [
    "professional, clean, modern",
    "warm, rustic, organic",
    "bold, vibrant, energetic",
    "minimal, elegant, muted tones",
    "dark moody, premium luxury",
  ];

  const variants: any[] = [];
  for (let i = 0; i < variantCount; i++) {
    const variant = JSON.parse(JSON.stringify(storyboard));
    variant._variant = { id: String.fromCharCode(65 + i), variations: {} as Record<string, string> };

    if (varyFields.includes("hook") && variant.scenes.length > 0) {
      const hookIdx = (i + 1) % hookVariations.length;
      const originalPrompt = variant.scenes[0].prompt;
      variant.scenes[0].prompt = `${originalPrompt}, ${hookVariations[hookIdx]}`;
      variant._variant.variations.hook = hookVariations[hookIdx];
    }

    if (varyFields.includes("music")) {
      const musicIdx = (i + 1) % musicVariations.length;
      variant.music.track = musicVariations[musicIdx];
      variant._variant.variations.music = musicVariations[musicIdx];
    }

    if (varyFields.includes("style")) {
      const styleIdx = (i + 1) % styleVariations.length;
      variant.style = styleVariations[styleIdx];
      variant._variant.variations.style = styleVariations[styleIdx];
    }

    if (variant._version) {
      variant._version.timestamp = new Date().toISOString();
    }

    const variantPath = join(outDir, sbPath.replace(/.*\//, "").replace(/\.json$/, `-variant-${variant._variant.id}.json`));
    variants.push({ variant, path: variantPath });

    if (values["dry-run"]) {
      console.log(`  Variant ${variant._variant.id}: ${JSON.stringify(variant._variant.variations)}`);
    } else {
      await Bun.write(variantPath, JSON.stringify(variant, null, 2));
      console.log(`  Variant ${variant._variant.id}: ${variantPath}`);
      console.log(`    ${JSON.stringify(variant._variant.variations)}`);
    }
  }

  if (!values["dry-run"]) {
    console.log(`\n${variantCount} variant storyboards saved to ${outDir}`);
    console.log(`To produce all variants:`);
    for (const { path } of variants) {
      console.log(`  bun video-producer.ts produce --brief "..." --storyboard "${path}"`);
    }
  }
}

async function cmdLipsync(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      image: { type: "string" },
      audio: { type: "string" },
      model: { type: "string", default: "sadtalker" },
      character: { type: "string" },
      output: { type: "string", default: "lipsync.mp4" },
    },
    allowPositionals: false,
  });

  // If --character provided and no --image, use character avatar
  if (values.character && !values.image) {
    const pack = await loadCharacter(values.character);
    if (pack.avatarPath) {
      values.image = pack.avatarPath;
      console.log(`  Using character avatar: ${pack.avatarPath}`);
    }
  }

  if (!values.image || !values.audio) {
    console.error("Error: --image (face reference) and --audio (voiceover) are required. Use --character to auto-load avatar.");
    process.exit(1);
  }

  if (!existsSync(resolve(values.image!))) {
    console.error(`Error: image not found: ${values.image}`);
    process.exit(1);
  }
  if (!existsSync(resolve(values.audio!))) {
    console.error(`Error: audio not found: ${values.audio}`);
    process.exit(1);
  }

  const outputPath = resolve(values.output!);
  ensureDir(dirname(outputPath));

  console.log(`Generating lip-synced video...`);
  console.log(`  Image: ${values.image}`);
  console.log(`  Audio: ${values.audio}`);
  console.log(`  Model: ${values.model}`);

  // fal.ai lip-sync models: sadtalker, wav2lip
  const falModels: Record<string, string> = {
    sadtalker: "fal-ai/sadtalker",
    wav2lip: "fal-ai/wav2lip",
  };

  const falModel = falModels[values.model!] || falModels.sadtalker;

  // Upload image and audio to fal first via fal-media, then call the model
  const imagePath = resolve(values.image!);
  const audioPath = resolve(values.audio!);

  // Use FAL_KEY directly for the lip-sync API call
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    console.error("Error: FAL_KEY not set. Add it in Zo Settings > Advanced > Secrets.");
    process.exit(1);
  }

  // Upload files to fal CDN
  console.log("  Uploading image to fal CDN...");
  const imageUpload = run(
    `curl -s -X POST "https://fal.run/fal-ai/upload" ` +
    `-H "Authorization: Key ${apiKey}" ` +
    `-F "file=@${imagePath}"`
  );
  let imageUrl: string;
  try {
    imageUrl = JSON.parse(imageUpload).url;
  } catch {
    // Fall back: use local file path with base64
    const imageBase64 = Buffer.from(await Bun.file(imagePath).arrayBuffer()).toString("base64");
    const ext = imagePath.split(".").pop() || "png";
    imageUrl = `data:image/${ext};base64,${imageBase64}`;
  }

  console.log("  Uploading audio to fal CDN...");
  const audioUpload = run(
    `curl -s -X POST "https://fal.run/fal-ai/upload" ` +
    `-H "Authorization: Key ${apiKey}" ` +
    `-F "file=@${audioPath}"`
  );
  let audioUrl: string;
  try {
    audioUrl = JSON.parse(audioUpload).url;
  } catch {
    const audioBase64 = Buffer.from(await Bun.file(audioPath).arrayBuffer()).toString("base64");
    audioUrl = `data:audio/mp3;base64,${audioBase64}`;
  }

  // Call the lip-sync model
  console.log(`  Running ${falModel}...`);
  const payload = JSON.stringify({
    source_image_url: imageUrl,
    driven_audio_url: audioUrl,
  });

  try {
    const result = run(
      `curl -s -X POST "https://fal.run/${falModel}" ` +
      `-H "Authorization: Key ${apiKey}" ` +
      `-H "Content-Type: application/json" ` +
      `-d '${payload.replace(/'/g, "'\\''")}'`
    );

    const parsed = JSON.parse(result);
    const videoUrl = parsed.video?.url || parsed.output?.url || parsed.url;

    if (!videoUrl) {
      console.error(`  No video URL in response: ${JSON.stringify(parsed).slice(0, 300)}`);
      process.exit(1);
    }

    // Download result
    run(`curl -s -o "${outputPath}" "${videoUrl}"`);
    console.log(`\nLip-synced video saved: ${outputPath}`);
  } catch (err: any) {
    console.error(`Lip-sync failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdAnalytics(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      platform: { type: "string", default: "tiktok" },
      "project-dir": { type: "string" },
      storyboard: { type: "string" },
      output: { type: "string", default: "analytics-report.md" },
    },
    allowPositionals: false,
  });

  const platform = values.platform!.toLowerCase();
  const account = PLATFORM_ACCOUNTS[platform];
  if (!account) {
    console.error(`Error: unsupported platform '${platform}'`);
    process.exit(1);
  }

  console.log(`Fetching analytics for ${platform}...`);

  // Pull recent post metrics via Blotato
  const blotatoPayload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: `get_${platform === "facebook" ? "facebook_page" : platform}_posts`,
      arguments: { accountId: account.accountId },
    },
  });

  let posts: any[] = [];
  try {
    const result = run(
      `curl -s -X POST "${BLOTATO_ENDPOINT}" ` +
      `-H "Content-Type: application/json" ` +
      `-H "blotato-api-key: $BLOTATO_API_KEY" ` +
      `-d '${blotatoPayload.replace(/'/g, "'\\''")}'`
    );
    const parsed = JSON.parse(result);
    posts = parsed.result?.content?.[0]?.text ? JSON.parse(parsed.result.content[0].text) : [];
  } catch (err: any) {
    console.warn(`  Could not fetch posts: ${err.message}`);
    console.log("  Generating report from storyboard metadata only...");
  }

  // Build analytics report
  const report: string[] = [
    `# Video Analytics Report — ${platform}`,
    `Generated: ${new Date().toISOString().split("T")[0]}`,
    "",
  ];

  if (posts.length > 0) {
    report.push(`## Recent Posts (${posts.length})`);
    report.push("");
    report.push("| Post | Views | Likes | Shares | Comments | Engagement Rate |");
    report.push("|------|-------|-------|--------|----------|----------------|");

    for (const post of posts.slice(0, 20)) {
      const views = post.views || post.play_count || post.impressions || 0;
      const likes = post.likes || post.like_count || post.reactions || 0;
      const shares = post.shares || post.share_count || 0;
      const comments = post.comments || post.comment_count || 0;
      const engagement = views > 0 ? (((likes + shares + comments) / views) * 100).toFixed(1) : "N/A";
      const title = (post.text || post.description || post.caption || "Untitled").slice(0, 40);
      report.push(`| ${title}... | ${views} | ${likes} | ${shares} | ${comments} | ${engagement}% |`);
    }

    // Aggregate insights
    const totalViews = posts.reduce((s, p) => s + (p.views || p.play_count || p.impressions || 0), 0);
    const totalLikes = posts.reduce((s, p) => s + (p.likes || p.like_count || p.reactions || 0), 0);
    const avgEngagement = totalViews > 0 ? ((totalLikes / totalViews) * 100).toFixed(1) : "N/A";

    report.push("");
    report.push("## Insights");
    report.push("");
    report.push(`- **Total views**: ${totalViews.toLocaleString()}`);
    report.push(`- **Total likes**: ${totalLikes.toLocaleString()}`);
    report.push(`- **Avg engagement**: ${avgEngagement}%`);
    report.push("");
  }

  // Recommendations
  report.push("## Recommendations for Next Video");
  report.push("");
  if (posts.length > 0) {
    const topPost = posts.sort((a, b) => (b.views || 0) - (a.views || 0))[0];
    report.push(`- **Best performing post**: "${(topPost?.text || "").slice(0, 60)}"`);
    report.push("- Consider similar hook style and topic for next video");
  }
  report.push("- Test hook variants with `bun video-producer.ts variants --storyboard sb.json --vary hook`");
  report.push("- A/B test music tracks: acoustic-warm vs upbeat-corporate");
  report.push("- Optimal posting times: 7-9am, 12-2pm, 7-10pm (platform local time)");
  report.push("- Keep videos under 15s for maximum completion rate on TikTok/Reels");

  // If storyboard provided, add scene-level analysis
  if (values.storyboard && existsSync(resolve(values.storyboard!))) {
    const sb = JSON.parse(await Bun.file(resolve(values.storyboard!)).text());
    report.push("");
    report.push("## Storyboard Analysis");
    report.push("");
    report.push(`- **Duration**: ${sb.duration}s (${sb.duration <= 15 ? "optimal" : "consider shortening"})`);
    report.push(`- **Scenes**: ${sb.scenes?.length || 0} (${(sb.scenes?.length || 0) <= 6 ? "good pacing" : "may feel rushed"})`);
    report.push(`- **Hook scene**: ${sb.scenes?.[0]?.end - sb.scenes?.[0]?.start || 0}s (aim for ≤3s)`);
    report.push(`- **Music**: ${sb.music?.track || "none"}`);
    report.push(`- **Caption style**: ${sb.caption_style || "none"}`);
  }

  const outputPath = resolve(values.output!);
  await Bun.write(outputPath, report.join("\n"));
  console.log(`Analytics report saved: ${outputPath}`);
  console.log(report.join("\n"));
}

function showHelp() {
  console.log(`
Video Producer CLI — End-to-end AI video production

Usage: bun video-producer.ts <command> [options]

Commands:
  produce      Full pipeline: brief → storyboard → generate → voiceover → captions → assemble
  storyboard   Generate storyboard JSON from a text brief
  generate     Generate scene images and video clips from storyboard
  voiceover    Generate voiceover audio from script text
  captions     Generate timed ASS/SRT caption file
  assemble     Compose final video from scenes + audio + captions
  optimize     Re-encode for a specific platform
  preview      Quick low-res preview from scene assets
  publish      Upload and publish video to TikTok/Facebook/Instagram via Blotato
  calendar     Batch-produce videos from a content calendar markdown file
  translate    Translate storyboard text/voiceover to another language
  variants     Generate A/B variant storyboards with different hooks/music/styles
  lipsync      Generate lip-synced talking-head video from image + audio
  analytics    Pull platform metrics and generate improvement recommendations

Run 'bun video-producer.ts <command> --help' for command-specific options.

Dependencies:
  - fal-ai-media skill (FAL_KEY in Zo Secrets)
  - elevenlabs-skill (ELEVENLABS_API_KEY in Zo Secrets) or OpenAI TTS fallback
  - ffmpeg (pre-installed on Zo)
  - Blotato API (BLOTATO_API_KEY in env) for publish/analytics commands
  - OpenAI API (OPENAI_API_KEY in Zo Secrets) for translate command
`);
}

async function main() {
  const command = Bun.argv[2];
  const args = Bun.argv.slice(3);

  if (!command || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case "produce": await cmdProduce(args); break;
    case "storyboard": await cmdStoryboard(args); break;
    case "generate": await cmdGenerate(args); break;
    case "voiceover": await cmdVoiceover(args); break;
    case "captions": await cmdCaptions(args); break;
    case "assemble": await cmdAssemble(args); break;
    case "optimize": await cmdOptimize(args); break;
    case "preview": await cmdPreview(args); break;
    case "publish": await cmdPublish(args); break;
    case "calendar": await cmdCalendar(args); break;
    case "translate": await cmdTranslate(args); break;
    case "variants": await cmdVariants(args); break;
    case "lipsync": await cmdLipsync(args); break;
    case "analytics": await cmdAnalytics(args); break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
