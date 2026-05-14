import type { Context } from "hono";
import { createHmac, randomBytes } from "node:crypto";

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const rlBuckets = new Map<string, number[]>();
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 30;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (rlBuckets.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_LIMIT) {
    rlBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  rlBuckets.set(ip, arr);
  if (rlBuckets.size > 5000) {
    for (const [k, v] of rlBuckets) {
      const fresh = v.filter((t) => now - t < RL_WINDOW_MS);
      if (fresh.length === 0) rlBuckets.delete(k);
      else rlBuckets.set(k, fresh);
    }
  }
  return true;
}

function buildCors(origin: string | undefined): Record<string, string> {
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

function issueToken(secret: string): { token: string; expires_at: number } {
  const exp = Date.now() + TOKEN_TTL_MS;
  const nonce = randomBytes(8).toString("hex");
  const payload = `v1.${exp}.${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${payload}.${sig}`, expires_at: exp };
}

function getClientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

export default async (c: Context): Promise<Response> => {
  const origin = c.req.header("origin");
  const cors = buildCors(origin);

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (c.req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) {
    return new Response(JSON.stringify({ error: "forbidden_origin" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const ip = getClientIp(c);
  if (!rateLimit(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": "60" },
    });
  }

  const secret = process.env.ZO_ASK_TOKEN;
  if (!secret) {
    return new Response(JSON.stringify({ error: "not_configured" }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { token, expires_at } = issueToken(secret);
  return new Response(JSON.stringify({ token, expires_at, ttl_ms: TOKEN_TTL_MS }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
