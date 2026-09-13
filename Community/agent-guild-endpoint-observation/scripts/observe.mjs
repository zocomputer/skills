// Original optional Zo skill helper, Copyright (c) 2026 AgentTanuki. MIT.
import https from 'node:https';
import { isIP } from 'node:net';
import { createHash } from 'node:crypto';

export const SERVICE = 'https://agent-guild-5d5r.onrender.com/preflight';
export const MAX_BYTES = 131072;
export const DEADLINE_MS = 6000;
export const CHECK_NAMES = Object.freeze([
  'endpoint_reachable', 'protocol_handshake', 'agent_card_resolves',
  'agent_card_signed', 'payment_claim_holds', 'independent_evidence',
]);
const LIMITS = Object.freeze([
  'Optional observation only: no permission, identity binding, endpoint ownership, safety or work-quality guarantee.',
  'agent_card_signed reports signature-field presence, not cryptographic verification. payment_claim_holds proven means a discovery-root HTTP 402 challenge, not a paid operation, settlement or refund verification.',
  'Unknown checks remain unknown, including when service_verdict is no_failed_checks. No later action is authorized or blocked by this helper.',
  'The exact selected public URL is disclosed to Guild, which actively probes it and records the request. Zo, its model provider and command logs may also retain the input and output.',
  'One HTTPS request, no retry or redirect; six-second JavaScript deadline and 128 KiB response cap. A stalled event loop or operating-system DNS work may outlive the timer. locally_observed_at is a local completion time, not a signed service timestamp.',
]);
class ObservationError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = (code) => { throw new ObservationError(code); };
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function targetURL(value) {
  if (typeof value !== 'string' || value.length > 4096 ||
      !value.startsWith('https://') || /[\s\u0000-\u001f\u007f\\#]/u.test(value)) fail('invalid_target');
  const authority = value.slice(8).split(/[/?]/u)[0];
  if (!authority || /[@%\u0080-\uffff]/u.test(authority)) fail('invalid_target');
  let u;
  try { u = new URL(value); } catch { fail('invalid_target'); }
  if (u.protocol !== 'https:' || u.username || u.password || !u.hostname) fail('invalid_target');
  const host = u.hostname.toLowerCase().replace(/\.$/u, '').replace(/^\[|\]$/gu, '');
  const ip = isIP(host);
  if (ip === 4) {
    const [a, b, c] = host.split('.').map(Number);
    if ([0, 10, 127].includes(a) || a >= 224 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || (b === 0 && [0, 2].includes(c)))) ||
        (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
        (a === 203 && b === 0 && c === 113)) fail('invalid_target');
  } else if (ip === 6) {
    if (!/^[23][0-9a-f]{3}:/u.test(host) || /^2001:(?:db8:|0:|:)/u.test(host) || host.startsWith('2002:')) fail('invalid_target');
  } else if (!host.includes('.') || host.length > 253 ||
      !/^[a-z0-9.-]+$/u.test(host) || host.split('.').some((p) => !p || p.length > 63 || /^-|-$/.test(p)) ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test|onion)$/u.test(host)) fail('invalid_target');
  // Lexical screening does not resolve DNS or establish publicness/ownership.
  return value;
}

// A bounded parser rejects ambiguous object keys before fixed-field projection.
function parseJSON(bytes) {
  if (bytes.length > MAX_BYTES) fail('response_too_large');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { fail('invalid_json'); }
  let at = 0, values = 0;
  const ws = () => { while (/[\x20\t\r\n]/u.test(text[at] ?? '') && at < text.length) at++; };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      const c = text[at++];
      if (c === '\\') { at++; continue; }
      if (c === '"') {
        try { return JSON.parse(text.slice(start, at)); } catch { fail('invalid_json'); }
      }
    }
    fail('invalid_json');
  };
  const value = (depth) => {
    if (depth > 16 || ++values > 2048) fail('response_complexity');
    ws();
    if (text[at] === '"') return string();
    if (text[at] === '{') {
      at++; ws(); const out = Object.create(null); const seen = new Set();
      if (text[at] === '}') { at++; return out; }
      while (at < text.length) {
        if (text[at] !== '"') fail('invalid_json');
        const key = string();
        if (seen.has(key)) fail('duplicate_json_key');
        seen.add(key); ws();
        if (text[at++] !== ':') fail('invalid_json');
        out[key] = value(depth + 1); ws();
        const next = text[at++];
        if (next === '}') return out;
        if (next !== ',') fail('invalid_json');
        ws();
      }
      fail('invalid_json');
    }
    if (text[at] === '[') {
      at++; ws(); const out = [];
      if (text[at] === ']') { at++; return out; }
      while (at < text.length) {
        out.push(value(depth + 1)); ws(); const next = text[at++];
        if (next === ']') return out;
        if (next !== ',') fail('invalid_json');
      }
      fail('invalid_json');
    }
    for (const [token, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, at)) { at += token.length; return parsed; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(text.slice(at));
    if (!match) fail('invalid_json');
    at += match[0].length;
    const parsed = Number(match[0]);
    if (!Number.isFinite(parsed)) fail('invalid_json');
    return parsed;
  };
  const parsed = value(0); ws();
  if (at !== text.length) fail('invalid_json');
  return parsed;
}

function sameNames(value, expected) {
  return Array.isArray(value) && value.length === expected.length &&
    new Set(value).size === value.length && value.every((n) => expected.includes(n));
}

function project(data, target) {
  if (!object(data) || data.target !== target) fail('target_mismatch');
  if (!Array.isArray(data.checks) || data.checks.length !== 6 ||
      !sameNames(data.checks.map((c) => object(c) ? c.check : null), CHECK_NAMES) ||
      data.checks.some((c) => !['proven', 'failed', 'unknown'].includes(c.status))) fail('invalid_checks');
  const checks = CHECK_NAMES.map((check) => ({ check, status: data.checks.find((c) => c.check === check).status }));
  const failed = checks.filter((c) => c.status === 'failed').map((c) => c.check);
  const unknowns = checks.filter((c) => c.status === 'unknown').map((c) => c.check);
  const scored = checks.filter((c) => c.status !== 'unknown').map((c) => c.check);
  const verdict = failed.some((n) => CHECK_NAMES.slice(0, 2).includes(n)) ? 'do_not_delegate' :
    failed.length ? 'delegate_with_caution' : 'no_failed_checks';
  if (!sameNames(data.failed, failed) || !sameNames(data.unknowns, unknowns) ||
      !sameNames(data.scored, scored) || data.verdict !== verdict) fail('inconsistent_evidence');
  return { checks, failed, unknowns, scored, service_verdict: verdict };
}

function readResponse(target) {
  return new Promise((resolve, reject) => {
    let settled = false, request, response;
    const chunks = []; let size = 0;
    const finish = (error, bytes) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) {
        response?.destroy(); request?.destroy(); reject(error);
      } else resolve(bytes);
    };
    const timer = setTimeout(() => finish(new ObservationError('deadline_exceeded')), DEADLINE_MS);
    try {
      request = https.request({
        protocol: 'https:', hostname: 'agent-guild-5d5r.onrender.com', port: 443,
        path: '/preflight?url=' + encodeURIComponent(target), method: 'GET',
        agent: false, rejectUnauthorized: true,
        headers: { 'Accept': 'application/json', 'Accept-Encoding': 'identity',
          'User-Agent': 'AgentGuild-Zo-Endpoint-Observation/0.1' },
      }, (incoming) => {
        response = incoming;
        if (settled) { incoming.destroy(); return; }
        incoming.on('error', () => finish(new ObservationError('transport_unavailable')));
        incoming.on('aborted', () => finish(new ObservationError('transport_unavailable')));
        incoming.on('close', () => { if (!incoming.complete) finish(new ObservationError('transport_unavailable')); });
        if (incoming.statusCode !== 200) { finish(new ObservationError('http_unavailable')); return; }
        const encoding = incoming.headers['content-encoding'];
        const type = incoming.headers['content-type'];
        if ((encoding && encoding !== 'identity') || typeof type !== 'string' ||
            !/^application\/json(?:\s*;|\s*$)/iu.test(type)) { finish(new ObservationError('unsupported_response')); return; }
        const length = incoming.headers['content-length'];
        if (length !== undefined && (typeof length !== 'string' || !/^\d+$/u.test(length) || Number(length) > MAX_BYTES)) {
          finish(new ObservationError('response_too_large')); return;
        }
        incoming.on('data', (chunk) => {
          if (settled) return;
          size += chunk.length;
          if (size > MAX_BYTES) { finish(new ObservationError('response_too_large')); return; }
          chunks.push(Buffer.from(chunk));
        });
        incoming.on('end', () => {
          if (!incoming.complete) { finish(new ObservationError('transport_unavailable')); return; }
          finish(null, Buffer.concat(chunks, size));
        });
      });
      request.on('error', () => finish(new ObservationError('transport_unavailable')));
      request.end();
    } catch { finish(new ObservationError('transport_unavailable')); }
  });
}

function unavailable(target, reason) {
  return { status: 'unavailable', target_url: target, source: SERVICE, reason,
    checks: [], failed: [], unknowns: [], scored: [], service_verdict: null,
    evidence: null, locally_observed_at: null, limits: [...LIMITS] };
}

export async function observe(value) {
  let target = null;
  try {
    target = targetURL(value);
    const bytes = await readResponse(target);
    const projection = project(parseJSON(bytes), target);
    return { status: 'observed', target_url: target, source: SERVICE,
      reason: 'consistent_service_observation', ...projection,
      evidence: { response_bytes: bytes.length, body_sha256: createHash('sha256').update(bytes).digest('hex') },
      locally_observed_at: new Date().toISOString(), limits: [...LIMITS] };
  } catch (e) {
    return unavailable(target, e instanceof ObservationError ? e.code : 'observation_unavailable');
  }
}

export async function runCLI(args) {
  if (args.length !== 2 || args[0] !== '--public-url') return unavailable(null, 'usage_public_url_required');
  return observe(args[1]);
}

if (import.meta.main) {
  const result = await runCLI(process.argv.slice(2));
  process.stdout.write(JSON.stringify(result) + '\n');
  process.exitCode = result.status === 'observed' ? 0 : 1;
}
