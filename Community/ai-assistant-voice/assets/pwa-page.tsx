import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface Message { role: "user" | "assistant" | "system"; text: string; time: string; }
interface PersonaOption { id: string; name: string; group?: string; voice?: string; }
interface ArchiveEntry { id: string; title: string; tags: string[]; messages: Message[]; createdAt: number; lastAt: number; convId: string; }

const ZO_SPACE = "{{ZO_HOST}}";
const TTS_ENDPOINT = `${ZO_SPACE}/api/tts`;
const ASK_ENDPOINT = `${ZO_SPACE}/api/{{ASSISTANT_SLUG}}-ask`;
const RT_SESSION = `${ZO_SPACE}/api/realtime-session`;
const RT_MODEL = "gpt-realtime-2";
const PERSONAS_ENDPOINT = `${ZO_SPACE}/api/{{ASSISTANT_SLUG}}-personas`;
const BOOTSTRAP_ENDPOINT = `${ZO_SPACE}/api/{{ASSISTANT_SLUG}}-bootstrap`;

// Single-entry fallback when both the baked PERSONAS_JSON and the dynamic
// /api/<slug>-personas route are unavailable. Empty {{DEFAULT_PERSONA_ID}}
// is filtered out at render time so the dropdown stays empty rather than
// pointing at a UUID the user doesn't own.
const FALLBACK_PERSONAS: PersonaOption[] = [
  { id: "{{DEFAULT_PERSONA_ID}}", name: "{{ASSISTANT_NAME}}", voice: "{{DEFAULT_VOICE}}" },
].filter(p => p.id && p.id.length === 36);
const DEFAULT_PERSONA_ID = "{{DEFAULT_PERSONA_ID}}";

const ELEVEN_VOICES: Record<string, string> = {
  Antoni: "ErXwobaYiN019PkySvjV",
  Rachel: "21m00Tcm4TlvDq8ikWAM",
  Bella: "EXAVITQu4vr4xnSDxMaL",
  Grace: "Yko7PKHZNXotIFUBG7I9",
};
const RT_VOICES = ["echo", "shimmer", "alloy", "ash", "coral", "sage", "verse"];

// Slow tools (median > 5s) get a one-line filler so the user hears something while we wait.
const SLOW_TOOL_NUDGES: Record<string, string> = {
  list_calendar_events: "Checking your calendar.",
  list_open_loops: "Pulling your open loops.",
  list_automations: "Fetching your automations.",
  list_agents: "Pulling your agents.",
  zo_ask: "One moment — consulting the workspace.",
};

// ── Token cache ───────────────────────────────────────────────────────
let tokenValue: string | null = null;
let tokenExpiry = 0;
let tokenInflight: Promise<string> | null = null;

async function obtainToken(): Promise<string> {
  const now = Date.now();
  if (tokenValue && now < tokenExpiry - 60_000) return tokenValue;
  if (tokenInflight) return tokenInflight;
  tokenInflight = (async () => {
    const resp = await fetch(BOOTSTRAP_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!resp.ok) throw new Error(`bootstrap ${resp.status}`);
    const data = await resp.json();
    tokenValue = data.token;
    tokenExpiry = data.expires_at;
    tokenInflight = null;
    return tokenValue!;
  })();
  return tokenInflight;
}

async function authedFetch(url: string, init: RequestInit = {}, retries = 1): Promise<Response> {
  const token = await obtainToken();
  const headers = new Headers(init.headers || {});
  headers.set("X-{{ASSISTANT_NAME}}-Auth", token);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const resp = await fetch(url, { ...init, headers });
  if (resp.status === 401 && retries > 0) {
    tokenValue = null;
    tokenExpiry = 0;
    return authedFetch(url, init, retries - 1);
  }
  return resp;
}

async function authedFetchWithRetry(url: string, init: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await authedFetch(url, init);
    if (resp.ok || (resp.status !== 502 && resp.status !== 503)) return resp;
    if (attempt < retries) await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
  }
  return authedFetch(url, init);
}

// ── AES-GCM device key + encrypted localStorage ────────────────────────
const DEVICE_KEY_LS = "alaric_device_key_v1";
let deviceKeyP: Promise<CryptoKey> | null = null;

function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getDeviceKey(): Promise<CryptoKey> {
  if (deviceKeyP) return deviceKeyP;
  deviceKeyP = (async () => {
    const stored = localStorage.getItem(DEVICE_KEY_LS);
    if (stored) {
      const raw = b64decode(stored);
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    }
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const exported = await crypto.subtle.exportKey("raw", key);
    localStorage.setItem(DEVICE_KEY_LS, b64encode(exported));
    return key;
  })();
  return deviceKeyP;
}

async function encryptString(plaintext: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const blob = new Uint8Array(iv.length + ct.byteLength);
  blob.set(iv, 0);
  blob.set(new Uint8Array(ct), iv.length);
  return "v1:" + b64encode(blob.buffer);
}

async function decryptString(payload: string): Promise<string | null> {
  if (!payload || !payload.startsWith("v1:")) return null;
  try {
    const key = await getDeviceKey();
    const blob = b64decode(payload.slice(3));
    const iv = blob.slice(0, 12);
    const ct = blob.slice(12);
    const buf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return new TextDecoder().decode(buf);
  } catch { return null; }
}

const CONV_LS = "alaric_conversation_id_enc";
async function loadConvId(): Promise<string> {
  const enc = localStorage.getItem(CONV_LS);
  if (enc) return (await decryptString(enc)) || "";
  // migrate plaintext if present
  const legacy = localStorage.getItem("alaric_conversation_id");
  if (legacy) {
    localStorage.removeItem("alaric_conversation_id");
    localStorage.setItem(CONV_LS, await encryptString(legacy));
    return legacy;
  }
  return "";
}
async function saveConvId(id: string): Promise<void> {
  if (!id) { localStorage.removeItem(CONV_LS); return; }
  localStorage.setItem(CONV_LS, await encryptString(id));
}

// ── Theme tokens ──────────────────────────────────────────────────────
type Theme = "dark" | "light";
const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    bg: "#09090b", surface: "#18181b", surface2: "#27272a", border: "#3f3f46",
    fg: "#f4f4f5", fgMuted: "#a1a1aa", fgDim: "#71717a", fgFaint: "#52525b",
    accent: "#7c3aed", accentSoft: "rgba(124,58,237,0.3)", success: "#22c55e",
    error: "#ef4444", warn: "#f59e0b", info: "#00d4aa", grad1: "#0078ff", grad2: "#2563eb",
  },
  light: {
    bg: "#fafafa", surface: "#ffffff", surface2: "#f4f4f5", border: "#e4e4e7",
    fg: "#18181b", fgMuted: "#52525b", fgDim: "#71717a", fgFaint: "#a1a1aa",
    accent: "#7c3aed", accentSoft: "rgba(124,58,237,0.25)", success: "#16a34a",
    error: "#dc2626", warn: "#d97706", info: "#0891b2", grad1: "#0078ff", grad2: "#2563eb",
  },
};

// ── Icons ─────────────────────────────────────────────────────────────
function MicIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function MicOffIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
}
function StopIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>; }
function VolumeIcon({ size = 20 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>; }
function SendIcon() { return <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>; }
function SettingsIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }
function CloseIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function RefreshIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.48"/></svg>; }
function EarIcon({ active }: { active: boolean }) { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: active ? "#22c55e" : "currentColor" }}><path d="M6 8a6 6 0 0 1 12 0c0 7-3 12-6 12a3 3 0 0 1-3-3"/><path d="M12 8a2 2 0 0 1 2 2c0 2.5-2 3-2 5"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>; }
function BoltIcon({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function ArchiveIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>; }
function SunIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>; }
function MoonIcon() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>; }
function DownloadIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function TrashIcon() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>; }

function ts() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function showToast(msg: string, type: string, setter: (t: { text: string; type: string } | null) => void, delay = 3000) {
  setter({ text: msg, type }); setTimeout(() => setter(null), delay);
}

const ANIMATIONS = `
@keyframes micPulseRed{0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)}70%{box-shadow:0 0 0 18px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
@keyframes micPulseTeal{0%{box-shadow:0 0 0 0 rgba(0,212,170,0.5)}70%{box-shadow:0 0 0 18px rgba(0,212,170,0)}100%{box-shadow:0 0 0 0 rgba(0,212,170,0)}}
@keyframes micPulseGreen{0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}70%{box-shadow:0 0 0 18px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
@keyframes msgIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes typingBounce{0%,60%,100%{transform:translateY(0);opacity:0.4}30%{transform:translateY(-6px);opacity:1}}
@keyframes portraitBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes portraitGlow{0%,100%{box-shadow:0 0 40px rgba(0,120,255,0.5),0 0 80px rgba(0,120,255,0.2)}50%{box-shadow:0 0 60px rgba(0,180,255,0.8),0 0 120px rgba(0,212,170,0.3)}}
@keyframes ring1{0%{transform:scale(1);opacity:0.7}100%{transform:scale(1.7);opacity:0}}
@keyframes ring2{0%{transform:scale(1);opacity:0.5}100%{transform:scale(2.1);opacity:0}}
@keyframes ring3{0%{transform:scale(1);opacity:0.35}100%{transform:scale(2.6);opacity:0}}
@keyframes wakeWordPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
`;

function SettingsPanel({ realtimeMode, rtVoice, personaId, elevenVoice, voiceQuality, theme, personas, onSave, onClose, t }: {
  realtimeMode: boolean; rtVoice: string; personaId: string; elevenVoice: string; voiceQuality: string; theme: Theme; personas: PersonaOption[];
  onSave: (rt: boolean, rtV: string, persona: string, elv: string, q: string) => void; onClose: () => void; t: Record<string, string>;
}) {
  const [rt, setRt] = useState(realtimeMode);
  const [rtV, setRtV] = useState(rtVoice);
  const [persona, setPersona] = useState(personaId);
  const [elv, setElv] = useState(elevenVoice);
  const [q, setQ] = useState(voiceQuality);

  const sel: React.CSSProperties = { width:"100%",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:10,color:t.fg,fontSize:14,padding:"11px 14px",outline:"none",appearance:"none",cursor:"pointer",fontFamily:"inherit" };
  const lbl: React.CSSProperties = { display:"block",fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",color:t.fgDim,marginBottom:8 };

  // group personas
  const grouped = useMemo(() => {
    const g: Record<string, PersonaOption[]> = {};
    for (const p of personas) {
      const k = p.group || "Other";
      (g[k] = g[k] || []).push(p);
    }
    return g;
  }, [personas]);

  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end" }}>
      <div onClick={onClose} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)" }} />
      <div style={{ position:"relative",background:t.surface,border:`1px solid ${t.border}`,borderBottom:"none",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85dvh",overflowY:"auto",padding:"28px 28px 48px" }}>
        <div style={{ width:36,height:4,background:t.border,borderRadius:2,margin:"0 auto 20px" }} />
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24 }}>
          <span style={{ fontSize:18,fontWeight:700,color:t.fg }}>Settings</span>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${t.border}`,background:t.surface2,color:t.fgMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><CloseIcon /></button>
        </div>

        <div style={{ marginBottom:20 }}>
          <label style={lbl}>Voice Quality</label>
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {[
              { v: "hf", title: "High Fidelity", sub: "Realtime + ElevenLabs" },
              { v: "ll", title: "Low Latency", sub: "Realtime / fallback" },
              { v: "browser", title: "Browser", sub: "Web Speech (free)" },
            ].map(opt => (
              <button key={opt.v} onClick={() => setQ(opt.v)} style={{ padding:"10px 8px",border:`1px solid ${q===opt.v?t.accent:t.border}`,background:q===opt.v?t.accentSoft:t.surface2,borderRadius:10,color:t.fg,cursor:"pointer",textAlign:"left",fontFamily:"inherit" }}>
                <div style={{ fontSize:12,fontWeight:600 }}>{opt.title}</div>
                <div style={{ fontSize:10,color:t.fgDim,marginTop:2 }}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:20,padding:16,background:rt?t.accentSoft:t.surface2,border:`1px solid ${rt?t.accent:t.border}`,borderRadius:12 }}>
          <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <p style={{ fontSize:14,fontWeight:600,color:t.fg,margin:0 }}>Realtime Mode</p>
              <p style={{ fontSize:12,color:t.fgDim,margin:"4px 0 0" }}>~300ms latency via OpenAI WebRTC</p>
            </div>
            <button onClick={() => setRt(v => !v)} disabled={q === "browser"} style={{ width:44,height:24,borderRadius:12,border:"none",cursor:q==="browser"?"not-allowed":"pointer",opacity:q==="browser"?0.4:1,background:rt?t.accent:t.border,position:"relative",transition:"background 0.2s" }}>
              <div style={{ position:"absolute",top:3,left:rt?23:3,width:18,height:18,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }} />
            </button>
          </div>
          {q === "browser" && <p style={{ fontSize:11,color:t.warn,margin:"8px 0 0" }}>Disabled in Browser quality mode.</p>}
        </div>

        {rt && (
          <div style={{ marginBottom:20 }}>
            <label style={lbl}>AI Persona ({personas.length}) — voice mapped per persona</label>
            <select value={persona} onChange={e => setPersona(e.target.value)} style={sel}>
              {Object.keys(grouped).sort().map(g => (
                <optgroup key={g} label={g}>
                  {grouped[g].map(p => <option key={p.id} value={p.id}>{p.name}{p.voice ? ` — ${p.voice}` : ''}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        {!rt && (
          <>
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>AI Persona ({personas.length})</label>
              <select value={persona} onChange={e => setPersona(e.target.value)} style={sel}>
                {Object.keys(grouped).sort().map(g => (
                  <optgroup key={g} label={g}>
                    {grouped[g].map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            {q !== "browser" && (
              <div style={{ marginBottom:20 }}>
                <label style={lbl}>ElevenLabs Voice</label>
                <select value={elv} onChange={e => setElv(e.target.value)} style={sel}>
                  {Object.keys(ELEVEN_VOICES).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        <div style={{ height:1,background:t.surface2,margin:"0 0 20px" }} />
        <button onClick={() => { onSave(rt,rtV,persona,elv,q); setTimeout(onClose,300); }} style={{ width:"100%",padding:13,background:t.accent,color:"#fff",fontSize:15,fontWeight:600,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"inherit" }}>
          Save Settings
        </button>
        <div style={{ marginTop:20,padding:16,background:t.surface2,borderRadius:12,border:`1px solid ${t.border}` }}>
          <p style={{ fontSize:12,color:t.fgFaint,lineHeight:1.7,margin:0 }}>
            <strong style={{ color:t.fgMuted }}>Privacy:</strong> Conversation IDs are encrypted (AES-GCM) in localStorage. All API calls use a short-lived bearer token bound to this origin.
          </p>
        </div>
      </div>
    </div>
  );
}

function ArchiveDrawer({ entries, currentId, theme, t, onLoad, onDelete, onExport, onClose }: {
  entries: ArchiveEntry[]; currentId: string; theme: Theme; t: Record<string, string>;
  onLoad: (e: ArchiveEntry) => void; onDelete: (id: string) => void; onExport: (e: ArchiveEntry, fmt: "json" | "md") => void; onClose: () => void;
}) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:100,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end" }}>
      <div onClick={onClose} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)" }} />
      <div style={{ position:"relative",background:t.surface,border:`1px solid ${t.border}`,borderBottom:"none",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85dvh",overflowY:"auto",padding:"28px 24px 48px" }}>
        <div style={{ width:36,height:4,background:t.border,borderRadius:2,margin:"0 auto 20px" }} />
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20 }}>
          <span style={{ fontSize:18,fontWeight:700,color:t.fg }}>Archive ({entries.length})</span>
          <button onClick={onClose} style={{ width:32,height:32,borderRadius:8,border:`1px solid ${t.border}`,background:t.surface2,color:t.fgMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><CloseIcon /></button>
        </div>
        {entries.length === 0 && <p style={{ color:t.fgDim,fontSize:14,textAlign:"center",padding:"32px 0" }}>No archived conversations yet.</p>}
        {entries.map(e => (
          <div key={e.id} style={{ marginBottom:12,padding:14,background:t.surface2,border:`1px solid ${e.id===currentId?t.accent:t.border}`,borderRadius:12 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8 }}>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:14,fontWeight:600,color:t.fg,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{e.title}</div>
                <div style={{ fontSize:11,color:t.fgDim,marginTop:4 }}>
                  {new Date(e.lastAt).toLocaleString()} · {e.messages.length} msg
                </div>
                {e.tags.length > 0 && (
                  <div style={{ display:"flex",gap:4,flexWrap:"wrap",marginTop:6 }}>
                    {e.tags.map(tag => (
                      <span key={tag} style={{ fontSize:10,padding:"2px 8px",background:t.accentSoft,color:t.accent,borderRadius:99,border:`1px solid ${t.accent}` }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:6,flexShrink:0 }}>
                <button onClick={() => onLoad(e)} style={{ fontSize:11,padding:"6px 10px",background:t.accent,color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontFamily:"inherit" }}>Load</button>
                <div style={{ display:"flex",gap:4 }}>
                  <button onClick={() => onExport(e, "json")} title="Export JSON" style={{ width:28,height:28,padding:0,border:`1px solid ${t.border}`,background:t.surface,color:t.fgMuted,borderRadius:6,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><DownloadIcon /></button>
                  <button onClick={() => onExport(e, "md")} title="Export Markdown" style={{ width:28,height:28,padding:0,border:`1px solid ${t.border}`,background:t.surface,color:t.fgMuted,borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:700 }}>MD</button>
                  <button onClick={() => onDelete(e.id)} title="Delete" style={{ width:28,height:28,padding:0,border:`1px solid ${t.border}`,background:t.surface,color:t.error,borderRadius:6,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><TrashIcon /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PTT_HOLD_MS = 2500;
const ARCHIVE_LS = "alaric_archive_v1";

export default function AlaricVoicePWA() {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("alaric_theme") as Theme) || "dark");
  const [voiceQuality, setVoiceQuality] = useState<string>(() => localStorage.getItem("alaric_voice_quality") || "hf");
  const [realtimeMode,setRealtimeMode] = useState(() => {
    const stored = localStorage.getItem("alaric_rt_mode");
    if (stored === null) return true;
    return stored !== "false";
  });
  const [rtVoice,setRtVoice] = useState(() => localStorage.getItem("alaric_rt_voice") || "echo");
  const [personaId,setPersonaId] = useState(() => localStorage.getItem("alaric_persona_id") || DEFAULT_PERSONA_ID);
  const [elevenVoice,setElevenVoice] = useState(() => localStorage.getItem("alaric_voice_name") || "Antoni");
  const [convId,setConvId] = useState("");
  const [messages,setMessages] = useState<Message[]>([]);
  const [inputText,setInputText] = useState("");
  const [isRecording,setIsRecording] = useState(false);
  const [isSpeaking,setIsSpeaking] = useState(false);
  const [isTyping,setIsTyping] = useState(false);
  const [showSettings,setShowSettings] = useState(false);
  const [showArchive,setShowArchive] = useState(false);
  const [toast_,setToast_] = useState<{text:string;type:string}|null>(null);
  const [wakeActive,setWakeActive] = useState(false);
  const [rtConnected,setRtConnected] = useState(false);
  const [rtConnecting,setRtConnecting] = useState(false);
  const [rtMuted,setRtMuted] = useState(false);
  const [rtUserText,setRtUserText] = useState("");
  const [personas, setPersonas] = useState<PersonaOption[]>(FALLBACK_PERSONAS);
  const [pttProgress, setPttProgress] = useState(0); // 0-100
  const [tagInput, setTagInput] = useState("");
  const [convTags, setConvTags] = useState<string[]>([]);
  const [archive, setArchive] = useState<ArchiveEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(ARCHIVE_LS) || "[]"); } catch { return []; }
  });

  const t = THEMES[theme];

  const convRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const speechRec = useRef<any>(null);
  const wakeRec = useRef<any>(null);
  const wakeTimer = useRef<any>(null);
  const wakeWasArmed = useRef<boolean>(false);
  const pressTimer = useRef<any>(null);
  const pressStart = useRef<number>(0);
  const pttRaf = useRef<number | null>(null);
  const pcRef = useRef<RTCPeerConnection|null>(null);
  const dcRef = useRef<RTCDataChannel|null>(null);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const localStream = useRef<MediaStream|null>(null);
  const wakeGatedMuted = useRef<boolean>(false); // true while track is muted *by wake gate* (vs user mute)
  const rtRemuteTimer = useRef<any>(null);       // timer that re-mutes track after assistant reply
  const wakeFireCooldown = useRef<number>(0);    // suppress repeat wake fires from interimResults
  const sendZoRef = useRef<((text:string)=>Promise<void>)|null>(null);
  const sessionStart = useRef<number>(Date.now());

  // Inject animations + apply theme to body
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = ANIMATIONS;
    document.head.appendChild(s);
    return () => { document.head.removeChild(s); };
  }, []);
  useEffect(() => {
    document.body.style.background = t.bg;
    document.body.style.color = t.fg;
  }, [theme, t.bg, t.fg]);

  // Load encrypted conversation_id
  useEffect(() => {
    let alive = true;
    loadConvId().then(id => { if (alive) setConvId(id); });
    return () => { alive = false; };
  }, []);

  // Load personas from API (warm fallback already set)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resp = await authedFetch(PERSONAS_ENDPOINT, { method: "GET" });
        if (!resp.ok) return;
        const data = await resp.json();
        if (alive && Array.isArray(data.personas)) setPersonas(data.personas);
      } catch { /* keep fallback */ }
    })();
    return () => { alive = false; };
  }, []);

  // Force-disable realtime in browser quality mode
  useEffect(() => {
    if (voiceQuality === "browser" && realtimeMode) {
      setRealtimeMode(false);
      localStorage.setItem("alaric_rt_mode", "false");
    }
  }, [voiceQuality, realtimeMode]);

  // Load convo tags
  useEffect(() => {
    if (!convId) { setConvTags([]); return; }
    try {
      const map = JSON.parse(localStorage.getItem("alaric_conv_tags_v1") || "{}");
      setConvTags(map[convId] || []);
    } catch { setConvTags([]); }
  }, [convId]);

  function persistConvTags(id: string, tags: string[]) {
    try {
      const map = JSON.parse(localStorage.getItem("alaric_conv_tags_v1") || "{}");
      if (tags.length) map[id] = tags; else delete map[id];
      localStorage.setItem("alaric_conv_tags_v1", JSON.stringify(map));
    } catch {}
  }

  function persistArchive(next: ArchiveEntry[]) {
    setArchive(next);
    try { localStorage.setItem(ARCHIVE_LS, JSON.stringify(next)); } catch {}
  }

  useEffect(() => { if(convRef.current) convRef.current.scrollTop=convRef.current.scrollHeight; },[messages,isTyping,rtUserText]);
  useEffect(() => { const tt=setTimeout(()=>showToast(realtimeMode?"Tap ⚡ to start a realtime session.":"Tap the mic or type to speak.","info",setToast_),800); return()=>clearTimeout(tt); },[]); // eslint-disable-line
  useEffect(() => { if("serviceWorker" in navigator) navigator.serviceWorker.register("{{PAGE_PATH}}/sw").catch(()=>{}); },[]);
  useEffect(() => ()=>{ disconnectRealtime(); stopWake(); if (pttRaf.current) cancelAnimationFrame(pttRaf.current); },[]); // eslint-disable-line

  async function fallbackTTS(text:string) {
    if(!("speechSynthesis" in window)) return;
    const u=new SpeechSynthesisUtterance(text);
    return new Promise(r=>{u.onend=r;u.onerror=r;speechSynthesis.speak(u);});
  }

  const speakText = useCallback(async(text:string)=>{
    if (voiceQuality === "browser") {
      setIsSpeaking(true);
      await fallbackTTS(text);
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    try {
      const resp = await authedFetch(TTS_ENDPOINT, { method:"POST", body: JSON.stringify({ text, voice_id: ELEVEN_VOICES[elevenVoice]||elevenVoice }) });
      if(!resp.ok) throw new Error(`TTS ${resp.status}`);
      const url=URL.createObjectURL(await resp.blob());
      const audio=new Audio(url);
      audio.onended=()=>{URL.revokeObjectURL(url);setIsSpeaking(false);};
      audio.onerror=()=>{URL.revokeObjectURL(url);fallbackTTS(text).then(()=>setIsSpeaking(false));};
      await audio.play();
    } catch {
      await fallbackTTS(text);
      setIsSpeaking(false);
    }
  },[elevenVoice,voiceQuality]);

  const handleRtEvent = useCallback((raw:MessageEvent)=>{
    let evt:any; try{evt=JSON.parse(raw.data);}catch{return;}
    // Diagnostic: surface session lifecycle + errors
    if (evt.type === "session.updated" || evt.type === "session.created") {
      console.log("[realtime]", evt.type, "instructions_len:", evt?.session?.instructions?.length, "tools:", evt?.session?.tools?.map((t:any)=>t.name||t.server_label));
    }
    if (evt.type === "mcp_list_tools") {
      console.log("[realtime] mcp_list_tools", evt?.server_label, "tools:", (evt?.tools||[]).map((t:any)=>t.name));
    }
    if (evt.type === "error") {
      console.error("[realtime] error event:", evt);
      showToast(`Realtime error: ${evt?.error?.message || "unknown"}`,"error",setToast_);
    }
    switch(evt.type){
      case"input_audio_buffer.speech_started": setIsRecording(true); setRtUserText(""); break;
      case"input_audio_buffer.speech_stopped": setIsRecording(false); break;
      case"conversation.item.input_audio_transcription.delta": setRtUserText(t=>t+(evt.delta||"")); break;
      case"conversation.item.input_audio_transcription.completed":
        if(evt.transcript?.trim()){const tx=evt.transcript.trim();setMessages(m=>[...m,{role:"user",text:tx,time:ts()}]);setRtUserText("");}
        break;
      case"response.content_part.added":
        if(evt.part?.type==="audio"){setIsSpeaking(true);}
        break;
      case"response.output_item.added":
        // Show typing indicator while MCP call is in-flight.
        // Do NOT send response.create here — it fires a competing response that
        // cuts off the native MCP execution cycle and prevents the result from
        // being spoken automatically.
        if (evt.item?.type === "mcp_call") {
          setIsTyping(true);
        }
        break;
      case"response.output_item.done":
        setIsSpeaking(false);
        if(evt.item?.type==="mcp_call"){
          setIsTyping(false);
          const toolName = evt.item?.name || "tool";
          const errored = !!evt.item?.error;
          const summary = errored ? `[${toolName}] error: ${evt.item?.error}` : `[${toolName}] ✓`;
          setMessages(m=>[...m,{role:"system",text:summary,time:ts()}]);
          // Realtime native MCP does not auto-continue after tool completion — explicitly
          // trigger the model to speak the result. Skip on error (model will handle via instructions).
          if(!errored && dcRef.current && dcRef.current.readyState === "open"){
            try { dcRef.current.send(JSON.stringify({ type: "response.create" })); } catch {}
          }
        } else if(evt.item?.role==="assistant"&&evt.item?.content?.length>0){
          const text=evt.item.content.map((c:any)=>c.transcript||c.text||"").filter(Boolean).join(" ");
          if(text) setMessages(m=>[...m,{role:"assistant",text,time:ts()}]);
        }
        break;
      case"response.done":
        // Re-mute mic after the ENTIRE response (all items) is complete — not on each intermediate item.
        // This prevents the re-mute race where an intermediate speech item fires the timer
        // before the model has finished generating the final spoken answer after a tool call.
        if(wakeGatedMuted.current && localStream.current){
          if(rtRemuteTimer.current) clearTimeout(rtRemuteTimer.current);
          rtRemuteTimer.current = setTimeout(()=>{
            const tr=localStream.current?.getAudioTracks()[0];
            if(tr){ tr.enabled=false; setRtMuted(true); }
          }, 1500);
        }
        break;
      case"error": showToast(`Realtime error: ${evt.error?.message||"unknown"}`,"error",setToast_); break;
    }
  },[]); // eslint-disable-line

  const sendZoMessage = useCallback(async(text:string)=>{
    if(!text||isTyping) return;
    setIsTyping(true);
    try {
      const payload:any={input:text,persona_id:personaId};
      if(convId) payload.conversation_id=convId;
      const resp = await authedFetchWithRetry(ASK_ENDPOINT, { method:"POST", body: JSON.stringify(payload) });
      if(!resp.ok) throw new Error(`API ${resp.status}`);
      const data=await resp.json();
      if(data.conversation_id){
        setConvId(data.conversation_id);
        await saveConvId(data.conversation_id);
      }
      setIsTyping(false);
      const reply=data.output||"No response. Please try again.";
      setMessages(m=>[...m,{role:"assistant",text:reply,time:ts()}]);
      await speakText(reply);
    } catch(err:any){
      setIsTyping(false);
      showToast(`Zo error: ${err?.message}`,"error",setToast_);
      setMessages(m=>[...m,{role:"system",text:`Request failed: ${err?.message}`,time:ts()}]);
    }
  },[isTyping,personaId,convId,speakText]);

  useEffect(()=>{sendZoRef.current=sendZoMessage;},[sendZoMessage]);

  const connectRealtime = useCallback(async()=>{
    if(rtConnected||rtConnecting) return;
    setRtConnecting(true);
    const MAX_RETRIES = 3;
    let lastErr = "";
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const sesResp = await authedFetch(RT_SESSION, { method:"POST", body: JSON.stringify({ persona_id: personaId, pack: "essentials" }) });
        if(!sesResp.ok){
          const err=await sesResp.json().catch(()=>({}));
          throw new Error((err as any).error||`Session error ${sesResp.status}`);
        }
        const session=await sesResp.json();
        const token=session.value;
        if(!token) throw new Error("No ephemeral token");
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        localStream.current=stream;
        const pc=new RTCPeerConnection(); pcRef.current=pc;
        const audio=new Audio(); audio.autoplay=true; audioRef.current=audio;
        pc.ontrack=(e)=>{audio.srcObject=e.streams[0];};
        pc.addTrack(stream.getTracks()[0]);
        const dc=pc.createDataChannel("oai-events"); dcRef.current=dc;
        dc.onmessage=handleRtEvent;
        dc.onerror=(e)=>{ console.error("[realtime] dc error", e); };
        dc.onopen=()=>{
          setRtConnected(true);
          setRtConnecting(false);
          showToast("Realtime connected — just start talking!","success",setToast_);
        };
        const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
        const sdpResp=await fetch(`https://api.openai.com/v1/realtime/calls?model=${RT_MODEL}`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/sdp"},body:offer.sdp});
        if(!sdpResp.ok) {
          const body = await sdpResp.text().catch(()=>"");
          let detail = `OpenAI SDP error ${sdpResp.status}`;
          if (sdpResp.status === 429) {
            detail = "OpenAI Realtime rate limit reached (429). Try again in 60s, or switch to Low Latency/Browser mode.";
          }
          if (body) detail += " — " + body.slice(0, 200);
          throw new Error(detail);
        }
        await pc.setRemoteDescription({type:"answer",sdp:await sdpResp.text()});
        return; // success
      } catch(err:any){
        lastErr = err?.message || "Unknown error";
        console.error(`[realtime] attempt ${attempt + 1}/${MAX_RETRIES} failed:`, lastErr);
        disconnectRealtime();
        if (attempt < MAX_RETRIES - 1) {
          const delay = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          showToast(`Retrying in ${delay/1000}s… (${attempt + 1}/${MAX_RETRIES})`, "warn", setToast_, delay);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    setRtConnecting(false);
    showToast(`Connect failed after ${MAX_RETRIES} attempts: ${lastErr}`, "error", setToast_);
  },[personaId,rtConnected,rtConnecting,handleRtEvent]);

  function disconnectRealtime(){
    if(rtRemuteTimer.current){clearTimeout(rtRemuteTimer.current);rtRemuteTimer.current=null;}
    wakeGatedMuted.current=false;
    if(dcRef.current){try{dcRef.current.close();}catch{}dcRef.current=null;}
    if(pcRef.current){try{pcRef.current.close();}catch{}pcRef.current=null;}
    if(localStream.current){localStream.current.getTracks().forEach(tr=>tr.stop());localStream.current=null;}
    if(audioRef.current){audioRef.current.srcObject=null;}
    setRtConnected(false);setRtConnecting(false);setIsRecording(false);setIsSpeaking(false);setRtUserText("");
  }

  const toggleRtMute=useCallback(()=>{
    if(!localStream.current) return;
    const track=localStream.current.getAudioTracks()[0]; if(!track) return;
    track.enabled=rtMuted; setRtMuted(v=>!v);
    // User mute overrides the wake gate.
    wakeGatedMuted.current=false;
    if(rtRemuteTimer.current){clearTimeout(rtRemuteTimer.current);rtRemuteTimer.current=null;}
    showToast(rtMuted?"Microphone unmuted":"Microphone muted","info",setToast_);
  },[rtMuted]);

  const sendRealtimeText=useCallback((text:string)=>{
    setMessages(m=>[...m,{role:"user",text,time:ts()}]); sendZoMessage(text);
  },[sendZoMessage]);

  const stopRecording=useCallback(()=>{
    setIsRecording(false); if(speechRec.current){try{speechRec.current.stop();}catch{}}
  },[]);

  const sendMessage=useCallback(async(text?:string)=>{
    const msg=(text||inputText).trim(); if(!msg||isTyping) return;
    setInputText(""); if(inputRef.current) inputRef.current.style.height="auto";
    setMessages(m=>[...m,{role:"user",text:msg,time:ts()}]); setIsTyping(true);
    try {
      const payload:any={input:msg,persona_id:personaId};
      if(convId) payload.conversation_id=convId;
      const resp = await authedFetchWithRetry(ASK_ENDPOINT, { method:"POST", body: JSON.stringify(payload) });
      if(!resp.ok) throw new Error(`API ${resp.status}`);
      const data=await resp.json();
      if(data.conversation_id){
        setConvId(data.conversation_id);
        await saveConvId(data.conversation_id);
      }
      setIsTyping(false);
      const reply=data.output||"No response. Please try again.";
      setMessages(m=>[...m,{role:"assistant",text:reply,time:ts()}]);
      await speakText(reply);
    } catch(err:any){
      setIsTyping(false); showToast(`Connection error: ${err?.message}`,"error",setToast_);
      setMessages(m=>[...m,{role:"system",text:`Request failed: ${err?.message}`,time:ts()}]);
    }
  },[inputText,isTyping,personaId,convId,speakText]);

  const startRecording=useCallback(()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){showToast("Speech recognition not supported.","error",setToast_);return;}
    if(!speechRec.current){
      const rec=new SR(); rec.continuous=false;rec.interimResults=true;rec.lang="en-US";
      rec.onresult=(e:any)=>{const r=e.results[e.results.length-1];if(r.isFinal){const tx=r[0].transcript.trim();if(tx){setInputText(tx);stopRecording();sendMessage(tx);}}};
      rec.onerror=(e:any)=>{if(e.error!=="no-speech")showToast("Voice error — try again.","error",setToast_);stopRecording();};
      rec.onend=()=>{setIsRecording(false);}; speechRec.current=rec;
    }
    setIsRecording(true); try{speechRec.current.start();}catch{}
  },[sendMessage,stopRecording]);

  // Push-to-talk gauge animation
  const beginPtt = useCallback(() => {
    pressStart.current = Date.now();
    setPttProgress(0);
    if (navigator.vibrate) navigator.vibrate(15);
    const tick = () => {
      const elapsed = Date.now() - pressStart.current;
      const pct = Math.min(100, (elapsed / PTT_HOLD_MS) * 100);
      setPttProgress(pct);
      if (pct < 100 && pressStart.current > 0) pttRaf.current = requestAnimationFrame(tick);
    };
    pttRaf.current = requestAnimationFrame(tick);
    pressTimer.current = setTimeout(() => {
      startRecording();
      if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
    }, 150);
  }, [startRecording]);

  const endPtt = useCallback(() => {
    pressStart.current = 0;
    if (pttRaf.current) { cancelAnimationFrame(pttRaf.current); pttRaf.current = null; }
    setPttProgress(0);
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    if (isRecording) stopRecording();
  }, [isRecording, stopRecording]);

  const WAKE_PHRASES=["hey {{ASSISTANT_SLUG}}","{{ASSISTANT_SLUG}}","hey eric","hey claric"];
  const stopWake=useCallback(()=>{
    if(wakeTimer.current){clearTimeout(wakeTimer.current);wakeTimer.current=null;}
    if(wakeRec.current){try{wakeRec.current.stop();}catch{}wakeRec.current=null;}
    setWakeActive(false);
  },[]);

  const startWake=useCallback(()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){showToast("Wake word not supported.","error",setToast_);return;}
    const rec=new SR(); rec.continuous=true;rec.interimResults=true;rec.lang="en-US";
    rec.onresult=(e:any)=>{
      for(let i=e.resultIndex;i<e.results.length;i++){
        const tx=e.results[i][0].transcript.toLowerCase().trim();
        if(WAKE_PHRASES.some(p=>tx.includes(p))){
          const now=Date.now();
          if(now - wakeFireCooldown.current < 2000) break; // suppress interim-result repeats
          wakeFireCooldown.current = now;
          const cmd=WAKE_PHRASES.reduce((s,p)=>s.replace(new RegExp(p,"gi"),""),tx).trim();
          if(realtimeMode&&rtConnected){
            // Wake gates realtime: unmute mic so the next utterance reaches OpenAI.
            const tr=localStream.current?.getAudioTracks()[0];
            if(tr){ tr.enabled=true; setRtMuted(false); wakeGatedMuted.current=true; }
            if(rtRemuteTimer.current){clearTimeout(rtRemuteTimer.current);rtRemuteTimer.current=null;}
            if(cmd.length>2) sendRealtimeText(cmd);
            else showToast("Listening…","info",setToast_,1500);
            // Safety re-mute if assistant never replies within 12s.
            rtRemuteTimer.current = setTimeout(()=>{
              const t2=localStream.current?.getAudioTracks()[0];
              if(t2){ t2.enabled=false; setRtMuted(true); }
            }, 12000);
          } else {
            if(cmd.length>2) sendMessage(cmd);
            else { showToast("Listening…","info",setToast_,1500); startRecording(); }
          }
          break;
        }
      }
    };
    rec.onend=()=>{if(wakeRec.current){wakeTimer.current=setTimeout(()=>{try{wakeRec.current?.start();}catch{}},300);}};
    rec.onerror=(e:any)=>{if(e.error==="not-allowed"){stopWake();showToast("Microphone access denied.","error",setToast_);}};
    wakeRec.current=rec;
    try{rec.start();setWakeActive(true);showToast('Wake word armed — say "Hey {{ASSISTANT_NAME}}"',"success",setToast_);}
    catch{showToast("Could not start wake word.","error",setToast_);}
  },[realtimeMode,rtConnected,sendRealtimeText,sendMessage,startRecording,stopWake]); // eslint-disable-line

  const toggleWake=useCallback(()=>{
    if(wakeActive){wakeWasArmed.current=false;stopWake();showToast("Wake word disarmed.","info",setToast_);}
    else{wakeWasArmed.current=true;startWake();}
  },[wakeActive,startWake,stopWake]);

  // Wake-gates-realtime: when both are active, the WebRTC mic stays muted until the
  // wake word fires. The wake handler unmutes; assistant-reply or timeout re-mutes.
  useEffect(()=>{
    if(!localStream.current) return;
    const tr=localStream.current.getAudioTracks()[0]; if(!tr) return;
    if(rtConnected && wakeActive){
      tr.enabled=false; setRtMuted(true); wakeGatedMuted.current=true;
      showToast('Wake-gated — say "Hey {{ASSISTANT_NAME}}" to talk',"info",setToast_,2500);
    } else if(rtConnected && !wakeActive && wakeGatedMuted.current){
      tr.enabled=true; setRtMuted(false); wakeGatedMuted.current=false;
      if(rtRemuteTimer.current){clearTimeout(rtRemuteTimer.current);rtRemuteTimer.current=null;}
    }
  },[rtConnected,wakeActive]);

  const archiveCurrent = useCallback(() => {
    if (messages.length === 0) return;
    const id = convId || `local-${Date.now()}`;
    const title = messages.find(m => m.role === "user")?.text.slice(0, 60) || "Untitled";
    const entry: ArchiveEntry = {
      id, title, tags: convTags, messages, convId,
      createdAt: sessionStart.current, lastAt: Date.now(),
    };
    const next = [entry, ...archive.filter(e => e.id !== id)].slice(0, 50);
    persistArchive(next);
    showToast("Conversation archived.","success",setToast_);
  }, [messages, convId, convTags, archive]);

  const clearSession=useCallback((skipArchive = false)=>{
    if (!skipArchive && messages.length > 1) archiveCurrent();
    if(realtimeMode&&rtConnected){disconnectRealtime();showToast("Session ended.","info",setToast_);}
    setMessages([]);setConvId("");setConvTags([]);saveConvId("");setRtUserText("");
    sessionStart.current = Date.now();
    if(!realtimeMode)showToast("New session started.","success",setToast_);
  },[realtimeMode,rtConnected,messages.length,archiveCurrent]);

  const handleSave=(rt:boolean,rtV:string,persona:string,elv:string,q:string)=>{
    if(!rt&&rtConnected)disconnectRealtime();
    if(rt&&rtConnected&&persona!==personaId){disconnectRealtime();showToast("Persona changed — reconnect to apply.","info",setToast_);}
    setRealtimeMode(rt);setRtVoice(rtV);setPersonaId(persona);setElevenVoice(elv);setVoiceQuality(q);
    localStorage.setItem("alaric_rt_mode",String(rt));localStorage.setItem("alaric_rt_voice",rtV);
    localStorage.setItem("alaric_persona_id",persona);localStorage.setItem("alaric_voice_name",elv);
    localStorage.setItem("alaric_voice_quality", q);
    showToast("Settings saved.","success",setToast_);
  };

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("alaric_theme", next);
  };

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || convTags.includes(tag)) { setTagInput(""); return; }
    const next = [...convTags, tag];
    setConvTags(next);
    setTagInput("");
    if (convId) persistConvTags(convId, next);
  }, [tagInput, convTags, convId]);

  const removeTag = useCallback((tag: string) => {
    const next = convTags.filter(x => x !== tag);
    setConvTags(next);
    if (convId) persistConvTags(convId, next);
  }, [convTags, convId]);

  function exportEntry(entry: ArchiveEntry, fmt: "json" | "md") {
    let content = "", mime = "", ext = "";
    if (fmt === "json") {
      content = JSON.stringify(entry, null, 2);
      mime = "application/json"; ext = "json";
    } else {
      const lines: string[] = [
        `# ${entry.title}`, "",
        `**Date:** ${new Date(entry.createdAt).toLocaleString()}`,
        `**Tags:** ${entry.tags.join(", ") || "—"}`,
        `**Messages:** ${entry.messages.length}`, "",
        "---", "",
      ];
      for (const m of entry.messages) {
        const who = m.role === "user" ? "👤 User" : m.role === "assistant" ? "🤖 {{ASSISTANT_NAME}}" : "⚙️ System";
        lines.push(`### ${who} · ${m.time}`, "", m.text, "");
      }
      content = lines.join("\n");
      mime = "text/markdown"; ext = "md";
    }
    const slug = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "{{ASSISTANT_SLUG}}";
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = `{{ASSISTANT_SLUG}}-${slug}-${entry.id.slice(0, 8)}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function loadArchiveEntry(e: ArchiveEntry) {
    if (messages.length > 0) archiveCurrent();
    setMessages(e.messages);
    setConvId(e.convId);
    setConvTags(e.tags);
    saveConvId(e.convId);
    sessionStart.current = e.createdAt;
    setShowArchive(false);
    showToast(`Loaded "${e.title.slice(0, 40)}"`, "success", setToast_);
  }

  function deleteArchiveEntry(id: string) {
    persistArchive(archive.filter(e => e.id !== id));
  }

  const statusText=realtimeMode
    ?rtConnecting?"Connecting…":rtConnected?(isRecording?"Listening…":isSpeaking?"Speaking…":"Live"):"Tap ⚡ to connect"
    :isSpeaking?"Speaking…":isRecording?"Listening…":isTyping?"Thinking…":"Ready";
  const statusColor=rtConnecting?t.warn
    :(rtConnected&&realtimeMode)||(!realtimeMode&&!isSpeaking&&!isRecording&&!isTyping)?t.success
    :isSpeaking?t.info:isRecording?t.error:isTyping?t.accent:t.fgFaint;

  const btnBase:React.CSSProperties={width:38,height:38,borderRadius:10,border:`1px solid ${t.border}`,background:t.surface2,color:t.fgMuted,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"};

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100dvh",background:t.bg,color:t.fg,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",position:"relative",overflow:"hidden" }}>
      <div style={{ position:"fixed",top:-200,left:"50%",transform:"translateX(-50%)",width:600,height:400,background:`radial-gradient(ellipse,${theme==="dark"?"rgba(0,120,255,0.18)":"rgba(0,120,255,0.08)"} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0 }} />
      <div style={{ position:"fixed",bottom:-150,right:-100,width:400,height:300,background:`radial-gradient(ellipse,${theme==="dark"?"rgba(6,182,212,0.1)":"rgba(6,182,212,0.06)"} 0%,transparent 70%)`,pointerEvents:"none",zIndex:0 }} />

      <header style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px 16px",position:"relative",zIndex:10,flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:18,fontWeight:700,color:t.fg,lineHeight:1.2,margin:0 }}>{{ASSISTANT_NAME}}</h1>
          <p style={{ fontSize:12,color:t.fgDim,marginTop:1 }}>Voice AI Assistant</p>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:8 }}>
          <button onClick={toggleTheme} title={theme==="dark"?"Light mode":"Dark mode"} style={btnBase}>{theme==="dark"?<SunIcon/>:<MoonIcon/>}</button>
          <button onClick={() => setShowArchive(true)} title="Archive" style={btnBase}><ArchiveIcon /></button>
          <button onClick={toggleWake} title="Wake word" style={{ ...btnBase,border:`1px solid ${wakeActive?"rgba(34,197,94,0.4)":t.border}`,background:wakeActive?"rgba(34,197,94,0.08)":t.surface2,position:"relative" }}>
            <EarIcon active={wakeActive} />
            {wakeActive&&<div style={{ position:"absolute",top:6,right:6,width:7,height:7,borderRadius:"50%",background:"#22c55e",animation:"wakeWordPulse 1.5s ease-in-out infinite" }} />}
          </button>
          {realtimeMode&&voiceQuality!=="browser"&&(
            <button onClick={rtConnected?()=>{disconnectRealtime();showToast("Disconnected.","info",setToast_);}:connectRealtime} disabled={rtConnecting} title="Realtime"
              style={{ ...btnBase,border:`1px solid ${rtConnected?"rgba(34,197,94,0.4)":rtConnecting?"rgba(245,158,11,0.4)":t.border}`,background:rtConnected?"rgba(34,197,94,0.1)":rtConnecting?"rgba(245,158,11,0.1)":t.surface2,color:rtConnected?t.success:rtConnecting?t.warn:t.fgMuted,cursor:rtConnecting?"default":"pointer" }}>
              {rtConnecting?<div style={{ width:14,height:14,border:`2px solid ${t.warn}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />:<BoltIcon />}
            </button>
          )}
          <button onClick={()=>clearSession()} title="New session" style={btnBase}><RefreshIcon /></button>
          <button onClick={()=>setShowSettings(true)} title="Settings" style={btnBase}><SettingsIcon /></button>
        </div>
      </header>

      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:8,position:"relative",zIndex:10,flexShrink:0 }}>
        <div style={{ position:"relative",width:280,height:280,display:"flex",alignItems:"center",justifyContent:"center" }}>
          {isSpeaking&&(
            <>
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(0,120,255,0.7)",animation:"ring1 1.6s ease-out infinite" }} />
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(0,212,170,0.5)",animation:"ring2 1.6s ease-out infinite 0.4s" }} />
              <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(0,120,255,0.35)",animation:"ring3 1.6s ease-out infinite 0.8s" }} />
            </>
          )}
          <div style={{ width:260,height:260,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"2px solid rgba(0,120,255,0.4)",animation:isSpeaking?"portraitBreathe 1.2s ease-in-out infinite,portraitGlow 1.2s ease-in-out infinite":"portraitGlow 4s ease-in-out infinite" }}>
            <img src="{{PORTRAIT_PATH}}" alt="AI Assistant" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
          </div>
        </div>
        <p style={{ fontSize:12,marginTop:8,letterSpacing:"0.06em",textTransform:"uppercase",color:statusColor,transition:"color 0.3s" }}>{statusText}</p>
        {realtimeMode&&voiceQuality!=="browser"&&(() => {
          const active = personas.find(p => p.id === personaId);
          const label = active ? `${active.name}${active.voice ? ` · ${active.voice}` : ''}` : rtVoice;
          return (
            <div style={{ marginTop:6,display:"flex",alignItems:"center",gap:4,fontSize:11,color:rtConnected?t.success:t.fgFaint,background:rtConnected?"rgba(34,197,94,0.08)":t.surface,border:`1px solid ${rtConnected?"rgba(34,197,94,0.2)":t.surface2}`,borderRadius:20,padding:"3px 10px" }}>
              <BoltIcon size={10} /><span>Realtime · {label} · {voiceQuality.toUpperCase()}</span>
            </div>
          );
        })()}
        <div style={{ marginTop:20,display:"flex",flexDirection:"column",alignItems:"center",gap:8,position:"relative" }}>
          {/* PTT progress ring */}
          {pttProgress > 0 && !realtimeMode && (
            <svg width={96} height={96} style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",pointerEvents:"none",zIndex:1 }}>
              <circle cx={48} cy={48} r={44} fill="none" stroke={t.border} strokeWidth={3} />
              <circle cx={48} cy={48} r={44} fill="none" stroke={t.accent} strokeWidth={3}
                strokeDasharray={`${(2*Math.PI*44)*(pttProgress/100)} ${2*Math.PI*44}`}
                transform="rotate(-90 48 48)" strokeLinecap="round" />
            </svg>
          )}
          <button
            style={{ width:80,height:80,borderRadius:"50%",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s",position:"relative",zIndex:2,...(isRecording?{background:t.error,animation:"micPulseRed 1.5s ease-out infinite"}:isSpeaking?{background:t.info,animation:"micPulseTeal 1.5s ease-out infinite"}:(realtimeMode&&rtConnected&&!rtMuted)?{background:t.success,animation:"micPulseGreen 2s ease-out infinite"}:{background:t.accent,boxShadow:`0 4px 24px ${t.accentSoft}`}) }}
            onClick={()=>{if(realtimeMode){if(rtConnected)toggleRtMute();else if(voiceQuality!=="browser")connectRealtime();else showToast("Realtime disabled in Browser quality.","info",setToast_);}else{if(isRecording)stopRecording();else startRecording();}}}
            onMouseDown={()=>{if(!realtimeMode){beginPtt();}}}
            onMouseUp={()=>{if(!realtimeMode){endPtt();}}}
            onMouseLeave={()=>{if(!realtimeMode&&pressStart.current>0){endPtt();}}}
            onTouchStart={e=>{if(!realtimeMode){e.preventDefault();beginPtt();}}}
            onTouchEnd={e=>{if(!realtimeMode){e.preventDefault();endPtt();}}}
          >
            {realtimeMode?rtMuted?<MicOffIcon size={32}/>:rtConnected?<MicIcon size={32}/>:<BoltIcon size={32}/>:isRecording?<StopIcon size={32}/>:isSpeaking?<VolumeIcon size={32}/>:<MicIcon size={32}/>}
          </button>
          <span style={{ fontSize:11,color:t.fgFaint,letterSpacing:"0.06em",textTransform:"uppercase" }}>
            {realtimeMode?rtConnecting?"Connecting…":rtConnected?(rtMuted?"Tap to unmute":"Tap to mute"):"Tap to connect":isRecording?"Tap to stop":"Push & hold to talk"}
          </span>
        </div>
      </div>

      {rtUserText&&<div style={{ padding:"0 24px 8px",position:"relative",zIndex:10,flexShrink:0 }}><p style={{ fontSize:13,color:t.fgDim,textAlign:"right",margin:0,fontStyle:"italic" }}>"{rtUserText}"</p></div>}

      {messages.length > 0 && (
        <div style={{ padding:"0 24px 8px",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",position:"relative",zIndex:10,flexShrink:0 }}>
          {convTags.map(tag => (
            <span key={tag} onClick={()=>removeTag(tag)} title="Click to remove" style={{ fontSize:10,padding:"3px 9px",background:t.accentSoft,color:t.accent,borderRadius:99,border:`1px solid ${t.accent}`,cursor:"pointer" }}>#{tag} ×</span>
          ))}
          <input
            value={tagInput}
            onChange={e=>setTagInput(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag();}}}
            onBlur={addTag}
            placeholder="+ tag"
            style={{ background:"transparent",border:`1px dashed ${t.border}`,color:t.fgMuted,fontSize:11,padding:"2px 8px",borderRadius:99,outline:"none",width:80,fontFamily:"inherit" }}
          />
          <button onClick={archiveCurrent} title="Archive" style={{ marginLeft:"auto",fontSize:10,padding:"3px 9px",background:t.surface2,color:t.fgMuted,border:`1px solid ${t.border}`,borderRadius:99,cursor:"pointer",fontFamily:"inherit" }}>Save</button>
        </div>
      )}

      <main ref={convRef} style={{ flex:1,overflowY:"auto",overflowX:"hidden",padding:"8px 24px 16px",position:"relative",zIndex:10,scrollBehavior:"smooth" }}>
        {messages.length===0&&(
          <div style={{ display:"flex",flexDirection:"column",alignItems:"center",textAlign:"center",padding:"16px 20px" }}>
            <p style={{ fontSize:14,color:t.fgDim,maxWidth:280,lineHeight:1.6 }}>
              {realtimeMode&&voiceQuality!=="browser"?"AI assistant + Zo tools. Tap ⚡ to start a realtime session.":"Tap the mic or type to speak."}
            </p>
          </div>
        )}
        {messages.map((m,i)=>{
          const isUser=m.role==="user",isSystem=m.role==="system";
          return(
            <div key={i} style={{ display:"flex",gap:10,marginBottom:20,flexDirection:isUser?"row-reverse":"row",animation:"msgIn 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
              <div style={{ width:34,height:34,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:700,marginTop:2,...(m.role==="assistant"?{background:`linear-gradient(135deg,${t.grad1},${t.grad2})`,color:"#fff"}:isUser?{background:t.surface2,color:t.fgMuted,border:`1px solid ${t.border}`}:{background:t.surface2,color:t.info,border:`1px solid ${t.border}`}) }}>
                {isUser?"U":isSystem?"⚡":"A"}
              </div>
              <div style={{ display:"flex",flexDirection:"column",gap:4,maxWidth:"82%",alignItems:isUser?"flex-end":"flex-start" }}>
                <div style={{ padding:"12px 16px",borderRadius:20,fontSize:15,lineHeight:1.55,wordBreak:"break-word",...(isUser?{background:t.accent,color:"#fff",borderBottomRightRadius:4}:isSystem?{background:"rgba(0,212,170,0.08)",border:"1px solid rgba(0,212,170,0.2)",color:t.info,fontSize:13,borderRadius:12}:{background:t.surface2,border:`1px solid ${t.border}`,borderBottomLeftRadius:4,color:t.fg}) }}>
                  {m.text.split("\n").map((l,li)=><p key={li} style={{ margin:0 }}>{l||<br/>}</p>)}
                </div>
                <span style={{ fontSize:10,color:t.fgFaint,padding:"0 4px" }}>{m.time}</span>
              </div>
            </div>
          );
        })}
        {isTyping&&(
          <div style={{ display:"flex",gap:10,marginBottom:20 }}>
            <div style={{ width:34,height:34,borderRadius:10,background:`linear-gradient(135deg,${t.grad1},${t.grad2})`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:700,color:"#fff" }}>A</div>
            <div style={{ background:t.surface2,border:`1px solid ${t.border}`,borderBottomLeftRadius:4,borderRadius:20,padding:"14px 18px",display:"flex",alignItems:"center",gap:6 }}>
              {[0,1,2].map(d=><div key={d} style={{ width:6,height:6,borderRadius:"50%",background:t.fgDim,animation:`typingBounce 1.2s ease-in-out infinite ${d*0.2}s` }} />)}
            </div>
          </div>
        )}
      </main>

      <div style={{ padding:"12px 20px 32px",position:"relative",zIndex:10,flexShrink:0 }}>
        <div style={{ background:t.surface,border:`1px solid ${t.border}`,borderRadius:20,display:"flex",alignItems:"flex-end",gap:8,padding:"8px 8px 8px 16px" }}>
          <textarea ref={inputRef} value={inputText}
            onChange={e=>{setInputText(e.target.value);e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";}}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(inputText.trim()){if(realtimeMode&&rtConnected){sendRealtimeText(inputText.trim());setInputText("");}else sendMessage();}}}}
            rows={1} placeholder="Type a message…" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            style={{ flex:1,background:"transparent",border:"none",outline:"none",color:t.fg,fontSize:15,lineHeight:1.5,resize:"none",minHeight:24,maxHeight:120,overflowY:"auto",padding:"3px 0",caretColor:t.accent,fontFamily:"inherit" }}
          />
          <button onClick={()=>{if(realtimeMode&&rtConnected){sendRealtimeText(inputText.trim());setInputText("");}else sendMessage();}} disabled={!inputText.trim()||isTyping}
            style={{ width:44,height:44,borderRadius:"50%",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,background:inputText.trim()&&!isTyping?t.accent:t.surface2,color:"#fff",boxShadow:inputText.trim()&&!isTyping?`0 4px 16px ${t.accentSoft}`:"none",transition:"all 0.15s" }}>
            <SendIcon />
          </button>
        </div>
      </div>

      {toast_&&(
        <div style={{ position:"fixed",bottom:100,left:"50%",transform:"translateX(-50%)",background:t.surface2,border:`1px solid ${toast_.type==="error"?"rgba(239,68,68,0.4)":toast_.type==="success"?"rgba(34,197,94,0.4)":t.border}`,borderRadius:12,padding:"10px 18px",fontSize:13,color:toast_.type==="error"?t.error:toast_.type==="success"?t.success:t.fg,zIndex:200,whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,0.4)" }}>
          {toast_.text}
        </div>
      )}

      {showSettings&&<SettingsPanel realtimeMode={realtimeMode} rtVoice={rtVoice} personaId={personaId} elevenVoice={elevenVoice} voiceQuality={voiceQuality} theme={theme} personas={personas} onSave={handleSave} onClose={()=>setShowSettings(false)} t={t} />}
      {showArchive&&<ArchiveDrawer entries={archive} currentId={convId} theme={theme} t={t} onLoad={loadArchiveEntry} onDelete={deleteArchiveEntry} onExport={exportEntry} onClose={()=>setShowArchive(false)} />}
    </div>
  );
}
