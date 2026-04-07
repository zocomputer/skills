#!/usr/bin/env bun
import { parseArgs } from "util";
import { existsSync, copyFileSync } from "fs";
import { dirname, join } from "path";

interface Scene {
  id: number;
  start: number;
  end: number;
  type: "image-to-video" | "text-to-video" | "static-image" | "user-asset";
  description: string;
  prompt: string;
  text_overlay: string | null;
  transition_in: "fade" | "dissolve" | "cut";
  camera_motion: string;
  voiceover: string;
}

interface StoryboardVersion {
  version: number;
  timestamp: string;
  brief: string;
}

interface Storyboard {
  title: string;
  platform: string;
  duration: number;
  aspect_ratio: string;
  resolution: [number, number];
  style: string;
  scenes: Scene[];
  music: { track: string; volume: number };
  caption_style: string;
  cta: { text: string; position: string } | null;
  voiceover_script: string;
  estimated_cost: { images: number; videos: number; voiceover: number; total: number };
  _version: StoryboardVersion;
}

const PLATFORM_PRESETS: Record<string, { aspect: string; resolution: [number, number]; maxDuration: number }> = {
  tiktok: { aspect: "9:16", resolution: [1080, 1920], maxDuration: 60 },
  reels: { aspect: "9:16", resolution: [1080, 1920], maxDuration: 90 },
  "youtube-shorts": { aspect: "9:16", resolution: [1080, 1920], maxDuration: 60 },
  facebook: { aspect: "4:5", resolution: [1080, 1350], maxDuration: 60 },
  youtube: { aspect: "16:9", resolution: [1920, 1080], maxDuration: 600 },
};

function parseSceneBreakdown(brief: string, platform: string, duration: number): Scene[] {
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.tiktok;
  const sceneCount = duration <= 5 ? 2 : duration <= 15 ? 4 : duration <= 30 ? 6 : 8;
  const sceneDuration = duration / sceneCount;
  const scenes: Scene[] = [];

  const hookScene: Scene = {
    id: 1,
    start: 0,
    end: Math.min(3, sceneDuration),
    type: "image-to-video",
    description: "Hook — attention-grabbing opening",
    prompt: `${brief}, dramatic opening shot, ${preset.aspect} vertical composition, cinematic lighting`,
    text_overlay: "Hook text overlay",
    transition_in: "fade",
    camera_motion: "slow zoom in",
    voiceover: "",
  };
  scenes.push(hookScene);

  for (let i = 1; i < sceneCount - 1; i++) {
    const start = hookScene.end + (i - 1) * sceneDuration;
    scenes.push({
      id: i + 1,
      start: Number(start.toFixed(1)),
      end: Number((start + sceneDuration).toFixed(1)),
      type: "image-to-video",
      description: `Scene ${i + 1} — body content`,
      prompt: `${brief}, scene ${i + 1}, ${preset.aspect} vertical composition, professional lighting`,
      text_overlay: null,
      transition_in: i === 1 ? "dissolve" : "cut",
      camera_motion: i % 2 === 0 ? "slight pan right" : "slight pan left",
      voiceover: "",
    });
  }

  scenes.push({
    id: sceneCount,
    start: Number((duration - Math.min(3, sceneDuration)).toFixed(1)),
    end: duration,
    type: "image-to-video",
    description: "CTA — call to action closing",
    prompt: `${brief}, product showcase with brand logo, clean background, ${preset.aspect} vertical composition`,
    text_overlay: "Call to action",
    transition_in: "dissolve",
    camera_motion: "static",
    voiceover: "",
  });

  return scenes;
}

function estimateCost(scenes: Scene[]): { images: number; videos: number; voiceover: number; total: number } {
  const imageCount = scenes.filter(s => s.type === "image-to-video" || s.type === "static-image").length;
  const videoSeconds = scenes.reduce((sum, s) => {
    if (s.type === "image-to-video" || s.type === "text-to-video") {
      return sum + (s.end - s.start);
    }
    return sum;
  }, 0);
  const images = imageCount * 0.04;
  const videos = videoSeconds * 0.07;
  const voiceover = 0.03;
  return { images, videos, voiceover, total: images + videos + voiceover };
}

async function generateStoryboard(brief: string, platform: string, duration: number, scenes?: number): Promise<Storyboard> {
  const preset = PLATFORM_PRESETS[platform] || PLATFORM_PRESETS.tiktok;
  const sceneList = parseSceneBreakdown(brief, platform, duration);
  const cost = estimateCost(sceneList);
  const voiceoverScript = sceneList.map(s => s.voiceover).filter(Boolean).join(" ");

  return {
    title: brief.slice(0, 60),
    platform,
    duration,
    aspect_ratio: preset.aspect,
    resolution: preset.resolution,
    style: "professional, clean, modern",
    scenes: sceneList,
    music: { track: "acoustic-warm", volume: 0.15 },
    caption_style: platform === "tiktok" || platform === "reels" ? "tiktok-bold" : "minimal-white",
    cta: null,
    voiceover_script: voiceoverScript,
    estimated_cost: cost,
    _version: { version: 1, timestamp: new Date().toISOString(), brief },
  };
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      brief: { type: "string" },
      platform: { type: "string", default: "tiktok" },
      duration: { type: "string", default: "15" },
      scenes: { type: "string" },
      output: { type: "string", default: "storyboard.json" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals[0] === "help") {
    console.log(`
Usage: bun storyboard.ts [options]

Generate a storyboard JSON from a text brief.

Options:
  --brief <text>      Video idea/brief (required)
  --platform <name>   Target platform: tiktok|reels|youtube-shorts|facebook|youtube (default: tiktok)
  --duration <sec>    Target duration in seconds (default: 15)
  --scenes <n>        Number of scenes (default: auto-calculated)
  --output <file>     Output storyboard JSON file (default: storyboard.json)
  --help              Show this help

Example:
  bun storyboard.ts --brief "15s TikTok ad for tallow balm" --platform tiktok --duration 15 --output storyboard.json
`);
    process.exit(0);
  }

  if (!values.brief) {
    console.error("Error: --brief is required");
    process.exit(1);
  }

  const duration = parseInt(values.duration!, 10);
  const sceneCount = values.scenes ? parseInt(values.scenes, 10) : undefined;

  console.log(`Generating storyboard...`);
  console.log(`  Brief: ${values.brief}`);
  console.log(`  Platform: ${values.platform}`);
  console.log(`  Duration: ${duration}s`);

  const storyboard = await generateStoryboard(values.brief!, values.platform!, duration, sceneCount);

  const outputPath = values.output!.startsWith("/") ? values.output! : `${process.cwd()}/${values.output}`;

  // Revision tracking: if output already exists, archive and bump version
  if (existsSync(outputPath)) {
    try {
      const prev = JSON.parse(await Bun.file(outputPath).text());
      const prevVersion = prev._version?.version || 1;
      storyboard._version.version = prevVersion + 1;
      // Archive previous version
      const dir = dirname(outputPath);
      const base = outputPath.replace(/\.json$/, "");
      const archivePath = `${base}.v${prevVersion}.json`;
      copyFileSync(outputPath, archivePath);
      console.log(`  Archived previous version → ${archivePath}`);
    } catch { /* first write or corrupt file, keep v1 */ }
  }

  await Bun.write(outputPath, JSON.stringify(storyboard, null, 2));

  console.log(`\nStoryboard saved to: ${outputPath}`);
  console.log(`  Scenes: ${storyboard.scenes.length}`);
  console.log(`  Aspect ratio: ${storyboard.aspect_ratio}`);
  console.log(`  Resolution: ${storyboard.resolution.join("×")}`);
  console.log(`\nEstimated cost:`);
  console.log(`  Images: $${storyboard.estimated_cost.images.toFixed(2)}`);
  console.log(`  Video clips: $${storyboard.estimated_cost.videos.toFixed(2)}`);
  console.log(`  Voiceover: $${storyboard.estimated_cost.voiceover.toFixed(2)}`);
  console.log(`  Total: $${storyboard.estimated_cost.total.toFixed(2)}`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
