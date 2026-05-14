#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const projectDir = resolve(args[0] || ".");
const outIndex = args.indexOf("--out");
const outDir = resolve(outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : join(projectDir, ".hyperframes", "anim-map"));

function walk(dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", ".hyperframes", "renders"].includes(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) entries.push(...walk(path));
    else if (extname(path).toLowerCase() === ".html") entries.push(path);
  }
  return entries;
}

function findCompositionId(html, file) {
  const match = html.match(/data-composition-id=["']([^"']+)["']/);
  return match?.[1] || basename(file, ".html");
}

function findDuration(html) {
  const match = html.match(/data-duration=["']([0-9.]+)["']/);
  return match ? Number(match[1]) : null;
}

function splitArgs(source) {
  const parts = [];
  let current = "";
  let depth = 0;
  let quote = null;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const prev = source[i - 1];
    if (quote) {
      current += char;
      if (char === quote && prev !== "\\") quote = null;
      continue;
    }
    if (["'", '"', "`"].includes(char)) {
      quote = char;
      current += char;
      continue;
    }
    if (["(", "{", "["].includes(char)) depth += 1;
    if ([")", "}", "]"].includes(char)) depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseVars(varsSource) {
  const vars = {};
  const propPattern = /([A-Za-z_$][\w$-]*)\s*:\s*([^,}\n]+)/g;
  for (const match of varsSource.matchAll(propPattern)) {
    vars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return vars;
}

function extractTweens(html) {
  const tweens = [];
  const callPattern = /(?:tl|gsap)\.(to|from|fromTo|set)\s*\(([^;]+?)\)\s*;?/gs;
  for (const match of html.matchAll(callPattern)) {
    const method = match[1];
    const args = splitArgs(match[2]);
    const target = args[0]?.trim() || "unknown";
    const varsSource = method === "fromTo" ? args[2] || "{}" : args[1] || "{}";
    const vars = parseVars(varsSource);
    const positionSource = method === "fromTo" ? args[3] : args[2];
    const duration = Number(vars.duration ?? (method === "set" ? 0 : 0.5));
    const position = positionSource ? positionSource.trim().replace(/^['"]|['"]$/g, "") : null;
    const properties = Object.keys(vars).filter((key) => !["duration", "delay", "ease", "stagger", "overwrite", "repeat", "yoyo", "onComplete", "onStart", "onUpdate", "immediateRender"].includes(key));
    tweens.push({ method, target, duration, ease: vars.ease || null, position, properties, vars });
  }
  return tweens;
}

function numericPosition(position, fallback) {
  if (!position) return fallback;
  if (/^[0-9.]+$/.test(position)) return Number(position);
  const relative = position.match(/^[<>]?\+=([0-9.]+)$/);
  if (relative) return fallback + Number(relative[1]);
  return fallback;
}

function buildTimeline(tweens, duration) {
  let cursor = 0;
  return tweens.map((tween) => {
    const start = numericPosition(tween.position, cursor);
    const end = start + tween.duration;
    cursor = Math.max(cursor, end);
    const flags = [];
    if (tween.duration > 0 && tween.duration < 0.2) flags.push("paced-fast");
    if (tween.duration > 2) flags.push("paced-slow");
    if (String(tween.vars.repeat) === "-1") flags.push("infinite-repeat");
    if (["display", "visibility", "width", "height", "top", "left"].some((prop) => tween.properties.includes(prop))) flags.push("layout-or-visibility-property");
    return { ...tween, start, end, flags };
  });
}

function asciiTimeline(items, duration) {
  const total = duration || Math.max(1, ...items.map((item) => item.end));
  const width = 80;
  return items.map((item, index) => {
    const start = Math.max(0, Math.floor((item.start / total) * width));
    const end = Math.min(width, Math.max(start + 1, Math.ceil((item.end / total) * width)));
    const bar = `${" ".repeat(start)}${"█".repeat(end - start)}`.padEnd(width, " ");
    return `${String(index + 1).padStart(2, "0")} ${bar} ${item.method} ${item.target}`;
  });
}

function summarize(item) {
  const props = item.properties.length ? item.properties.join("+") : "no visual props detected";
  return `${item.target} ${item.method} animates ${props} over ${item.duration.toFixed(2)}s at ${item.start.toFixed(2)}s${item.ease ? ` using ${item.ease}` : ""}.`;
}

const files = walk(projectDir);
const compositions = files.map((file) => {
  const html = readFileSync(file, "utf8");
  const compositionId = findCompositionId(html, file);
  const duration = findDuration(html);
  const timeline = buildTimeline(extractTweens(html), duration);
  const deadZones = [];
  const sorted = [...timeline].sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i].start - sorted[i - 1].end;
    if (gap > 1) deadZones.push({ from: sorted[i - 1].end, to: sorted[i].start, duration: gap });
  }
  return {
    file,
    compositionId,
    duration,
    tweenCount: timeline.length,
    summaries: timeline.map(summarize),
    timeline,
    ascii: asciiTimeline(timeline, duration),
    flags: timeline.flatMap((item) => item.flags.map((flag) => ({ flag, target: item.target, start: item.start, properties: item.properties }))),
    deadZones
  };
});

const result = {
  projectDir,
  generatedAt: new Date().toISOString(),
  note: "Static GSAP scanner. Use with hyperframes inspect/validate; this does not replace visual review.",
  compositions
};

mkdirSync(outDir, { recursive: true });
const outputFile = join(outDir, "animation-map.json");
writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(outputFile);
