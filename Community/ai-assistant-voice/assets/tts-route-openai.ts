import type { Context } from "hono";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";
const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const MAX_TEXT_LEN = 4096;
const VALID_VOICES = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);
const DEFAULT_VOICE = "onyx";

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

export default async (c: Context): Promise<Response> => {
  const origin = c.req.header("origin");
  const cors = buildCorsHeaders(origin);

  if (c.req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (c.req.method !== "POST") return jsonError({ error: "method_not_allowed" }, 405, cors);
  if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) return jsonError({ error: "forbidden_origin" }, 403, cors);

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return jsonError({ error: "tts_unconfigured" }, 503, cors);

  let body: { text?: unknown; voice_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return jsonError({ error: "bad_json" }, 400, cors);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice =
    typeof body.voice_id === "string" && VALID_VOICES.has(body.voice_id)
      ? body.voice_id
      : DEFAULT_VOICE;

  if (!text) return jsonError({ error: "missing_text" }, 400, cors);
  if (text.length > MAX_TEXT_LEN) return jsonError({ error: "text_too_long", max: MAX_TEXT_LEN }, 400, cors);

  const upstream = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: "mp3",
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("[tts-openai] upstream error", upstream.status, errText.slice(0, 300));
    return jsonError({ error: "upstream_error", status: upstream.status }, 502, cors);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
};
