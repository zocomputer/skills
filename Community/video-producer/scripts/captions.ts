#!/usr/bin/env bun
import { parseArgs } from "util";
import { readFileSync, existsSync } from "fs";

interface CaptionSegment {
  text: string;
  start: number;
  end: number;
}

const CAPTION_STYLES: Record<string, { fontName: string; fontSize: number; primaryColor: string; outlineColor: string; backColor: string; bold: boolean; outline: number; shadow: number; alignment: number; marginV: number }> = {
  "tiktok-bold": {
    fontName: "Montserrat",
    fontSize: 48,
    primaryColor: "&H00FFFFFF",
    outlineColor: "&H00000000",
    backColor: "&H80000000",
    bold: true,
    outline: 3,
    shadow: 0,
    alignment: 2,
    marginV: 120,
  },
  "minimal-white": {
    fontName: "Arial",
    fontSize: 36,
    primaryColor: "&H00FFFFFF",
    outlineColor: "&H00000000",
    backColor: "&H00000000",
    bold: false,
    outline: 2,
    shadow: 1,
    alignment: 2,
    marginV: 80,
  },
  "brand-ffb": {
    fontName: "Montserrat",
    fontSize: 42,
    primaryColor: "&H00E8DCC8",
    outlineColor: "&H002D1810",
    backColor: "&H00000000",
    bold: true,
    outline: 3,
    shadow: 0,
    alignment: 2,
    marginV: 100,
  },
};

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const cs = Math.round((s - Math.floor(s)) * 100);
  return `${h}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function segmentScript(script: string, totalDuration: number): CaptionSegment[] {
  const sentences = script.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return [];

  const segments: CaptionSegment[] = [];
  const segmentDuration = totalDuration / sentences.length;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    const words = sentence.split(/\s+/);
    const wordsPerChunk = 4;
    const chunkCount = Math.ceil(words.length / wordsPerChunk);
    const chunkDuration = segmentDuration / chunkCount;

    for (let c = 0; c < chunkCount; c++) {
      const chunkWords = words.slice(c * wordsPerChunk, (c + 1) * wordsPerChunk);
      const start = i * segmentDuration + c * chunkDuration;
      const end = start + chunkDuration;
      segments.push({
        text: chunkWords.join(" "),
        start: Number(start.toFixed(2)),
        end: Number(Math.min(end, totalDuration).toFixed(2)),
      });
    }
  }

  return segments;
}

function generateASS(segments: CaptionSegment[], styleName: string, resolution: [number, number]): string {
  const style = CAPTION_STYLES[styleName] || CAPTION_STYLES["tiktok-bold"];

  let ass = `[Script Info]
Title: Video Producer Captions
ScriptType: v4.00+
PlayResX: ${resolution[0]}
PlayResY: ${resolution[1]}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontName},${style.fontSize},${style.primaryColor},&H000000FF,${style.outlineColor},${style.backColor},${style.bold ? -1 : 0},0,0,0,100,100,0,0,1,${style.outline},${style.shadow},${style.alignment},40,40,${style.marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const seg of segments) {
    const start = formatAssTime(seg.start);
    const end = formatAssTime(seg.end);
    const text = seg.text.replace(/\n/g, "\\N");
    ass += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
  }

  return ass;
}

function generateSRT(segments: CaptionSegment[]): string {
  let srt = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    srt += `${i + 1}\n`;
    srt += `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n`;
    srt += `${seg.text}\n\n`;
  }
  return srt;
}

async function main() {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      script: { type: "string" },
      duration: { type: "string", default: "15" },
      style: { type: "string", default: "tiktok-bold" },
      format: { type: "string", default: "ass" },
      resolution: { type: "string", default: "1080x1920" },
      output: { type: "string", default: "captions.ass" },
      help: { type: "boolean", default: false },
    },
    allowPositionals: true,
  });

  if (values.help || positionals[0] === "help") {
    console.log(`
Usage: bun captions.ts [options]

Generate timed caption files (ASS/SRT) from script text.

Options:
  --script <text|file>   Caption text or path to a text file (required)
  --duration <sec>       Total video duration in seconds (default: 15)
  --style <name>         Caption style: tiktok-bold|minimal-white|brand-ffb (default: tiktok-bold)
  --format <type>        Output format: ass|srt (default: ass)
  --resolution <WxH>     Video resolution for ASS positioning (default: 1080x1920)
  --output <file>        Output caption file (default: captions.ass)
  --help                 Show this help

Styles:
  tiktok-bold   — Large white bold text with black outline, centered bottom
  minimal-white — Clean white text with subtle outline
  brand-ffb     — Fauna & Flora Botanicals brand style (warm cream on brown)

Example:
  bun captions.ts --script "Your skin deserves better. Natural tallow balm." --duration 15 --style tiktok-bold --output captions.ass
  bun captions.ts --script /path/to/script.txt --duration 30 --format srt --output captions.srt
`);
    process.exit(0);
  }

  if (!values.script) {
    console.error("Error: --script is required (text or file path)");
    process.exit(1);
  }

  let scriptText = values.script!;
  if (existsSync(scriptText)) {
    scriptText = readFileSync(scriptText, "utf-8").trim();
  }

  const duration = parseFloat(values.duration!);
  const [w, h] = values.resolution!.split("x").map(Number) as [number, number];

  console.log(`Generating ${values.format!.toUpperCase()} captions...`);
  console.log(`  Script: "${scriptText.slice(0, 80)}${scriptText.length > 80 ? "..." : ""}"`);
  console.log(`  Duration: ${duration}s`);
  console.log(`  Style: ${values.style}`);

  const segments = segmentScript(scriptText, duration);

  let content: string;
  if (values.format === "srt") {
    content = generateSRT(segments);
  } else {
    content = generateASS(segments, values.style!, [w, h]);
  }

  const outputPath = values.output!.startsWith("/") ? values.output! : `${process.cwd()}/${values.output}`;
  await Bun.write(outputPath, content);

  console.log(`\nCaptions saved to: ${outputPath}`);
  console.log(`  Segments: ${segments.length}`);
  console.log(`  Format: ${values.format!.toUpperCase()}`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
