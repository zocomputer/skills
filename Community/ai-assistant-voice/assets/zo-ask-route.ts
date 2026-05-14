import type { Context } from "hono";

const ZO_ASK_ENDPOINT = "https://api.zo.computer/zo/ask";
const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const MAX_INPUT_LEN = 8000;

function buildCorsHeaders(origin: string | undefined): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGIN_REGEX.test(origin)
      ? origin
      : "{{ZO_HOST}}";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

  // Server-side Zo token — set ZO_ASK_TOKEN in Zo Secrets (Settings > Advanced)
  const zoToken = process.env.ZO_ASK_TOKEN;
  if (!zoToken) {
    return jsonError({ error: "not_configured", hint: "Set ZO_ASK_TOKEN in Zo Secrets" }, 503, cors);
  }

  let body: { input?: unknown; model_name?: unknown; persona_id?: unknown; conversation_id?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return jsonError({ error: "bad_json" }, 400, cors);
  }

  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) return jsonError({ error: "missing_input" }, 400, cors);
  if (input.length > MAX_INPUT_LEN) return jsonError({ error: "input_too_long", max: MAX_INPUT_LEN }, 400, cors);

  const payload: Record<string, unknown> = { input };
  if (typeof body.model_name === "string" && body.model_name) payload.model_name = body.model_name;
  if (typeof body.persona_id === "string" && body.persona_id) payload.persona_id = body.persona_id;
  if (typeof body.conversation_id === "string" && body.conversation_id) payload.conversation_id = body.conversation_id;

  let upstream: Response;
  try {
    upstream = await fetch(ZO_ASK_ENDPOINT, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${zoToken}`,
        "content-type": "application/json",
        "accept": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[zo-ask] fetch failed", err);
    return jsonError({ error: "upstream_unreachable" }, 502, cors);
  }

  const upstreamText = await upstream.text();

  if (upstream.status === 401 || upstream.status === 403) {
    return jsonError({ error: "invalid_zo_token", hint: "Regenerate ZO_ASK_TOKEN in Zo Secrets" }, 401, cors);
  }

  if (!upstream.ok) {
    console.error("[zo-ask] upstream error", upstream.status, upstreamText.slice(0, 300));
    return jsonError({ error: "upstream_error", status: upstream.status }, 502, cors);
  }

  return new Response(upstreamText, {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
