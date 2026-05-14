import type { Context } from "hono";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const MAX_TEXT_LEN = 5000;
const DEFAULT_VOICE = "en-US-GuyNeural";

function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGIN_REGEX.test(origin)
      ? origin
      : "{{ZO_HOST}}";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Zo-User-Token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonError(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function runEdgeTts(text: string, voice: string, outFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("edge-tts", ["--voice", voice, "--text", text, "--write-media", outFile]);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`edge-tts exited ${code}`))));
    proc.on("error", reject);
  });
}

export default async (c: Context): Promise<Response> => {
  const origin = c.req.header("origin");
  const cors = buildCorsHeaders(origin);

  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (c.req.method !== "POST") return jsonError({ error: "method_not_allowed" }, 405, cors);
  if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) return jsonError({ error: "forbidden_origin" }, 403, cors);

  let body: { text?: unknown; voice_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return jsonError({ error: "bad_json" }, 400, cors);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice_id === "string" && body.voice_id ? body.voice_id : DEFAULT_VOICE;

  if (!text) return jsonError({ error: "missing_text" }, 400, cors);
  if (text.length > MAX_TEXT_LEN) return jsonError({ error: "text_too_long", max: MAX_TEXT_LEN }, 400, cors);

  const outFile = join(tmpdir(), `pv-tts-${randomUUID()}.mp3`);

  try {
    await runEdgeTts(text, voice, outFile);
    const audio = await readFile(outFile);
    return new Response(audio, {
      status: 200,
      headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[tts-edge] error:", err);
    return jsonError({ error: "tts_failed", detail: String(err) }, 500, cors);
  } finally {
    unlink(outFile).catch(() => {});
  }
};
