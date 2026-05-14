import type { Context } from "hono";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/text-to-speech";
const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const VOICE_ID_REGEX = /^[A-Za-z0-9]{20}$/;
const DEFAULT_VOICE_ID = "ErXwobaYiN019PkySvjV"; // Antoni
const MAX_TEXT_LEN = 5000;

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

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (c.req.method !== "POST") {
    return jsonError({ error: "method_not_allowed" }, 405, cors);
  }

  // Gate on Origin — only zo.space / zo.computer domains allowed
  if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) {
    return jsonError({ error: "forbidden_origin" }, 403, cors);
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenKey) {
    return jsonError({ error: "tts_unconfigured" }, 503, cors);
  }

  let body: { text?: unknown; voice_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return jsonError({ error: "bad_json" }, 400, cors);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voiceId =
    typeof body.voice_id === "string" && body.voice_id ? body.voice_id : DEFAULT_VOICE_ID;

  if (!text) {
    return jsonError({ error: "missing_text" }, 400, cors);
  }
  if (text.length > MAX_TEXT_LEN) {
    return jsonError({ error: "text_too_long", max: MAX_TEXT_LEN }, 400, cors);
  }
  if (!VOICE_ID_REGEX.test(voiceId)) {
    return jsonError({ error: "bad_voice_id" }, 400, cors);
  }

  const upstream = await fetch(
    `${ELEVENLABS_BASE}/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": elevenKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_flash_v2_5",
        voice_settings: {
          stability: 0.85,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    console.error("[tts] upstream error", upstream.status, errText.slice(0, 300));
    return jsonError(
      { error: "upstream_error", status: upstream.status },
      502,
      cors,
    );
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
};
