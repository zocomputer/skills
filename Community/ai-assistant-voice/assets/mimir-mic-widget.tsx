import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

const LILY_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku";
const SESSION_ENDPOINT = "/api/mimir-realtime-session";
const TTS_ENDPOINT = "/api/tts";

const PRONUNCIATION_FIXES: Array<[RegExp, string]> = [
  [/\bZouroboros\b/g, "Zoo-roe-bore-ose"],
  [/\bZo Computer's\b/gi, "Zoe, Computer's"],
  [/\bZo Computer\b/gi, "Zoe, Computer"],
  [/\bZo\.computer\b/gi, "Zoe dot computer"],
  [/\bZo\.space\b/gi, "Zoe dot space"],
  [/\bZo\b/g, "Zoe"],
  [/\bMimir\b/g, "Meemir"],
  [/\bQdrant\b/g, "Q-drant"],
  [/\bSQLite\b/gi, "S-Q-Lite"],
  [/\bFTS5\b/g, "F-T-S five"],
  [/\bBM25\b/g, "B-M twenty-five"],
  [/\bOmniRoute\b/g, "Omni-Route"],
  [/\bYggdrasil\b/g, "Ig-druh-sill"],
  [/\bACP\b/g, "A-C-P"],
  [/\bSSE\b/g, "S-S-E"],
  [/\bTUI\b/g, "T-U-I"],
  [/\bRAG\b/g, "rag"],
  [/\bECC-009\b/g, "E-C-C zero zero nine"],
  [/\bMIT\b/g, "M-I-T"],
];

function respell(text: string): string {
  let out = text;
  for (const [re, sub] of PRONUNCIATION_FIXES) out = out.replace(re, sub);
  return out;
}

type Status = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

export default function MimirMicWidget() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playStartRef = useRef<number>(0);
  const responseBufRef = useRef<string>("");
  const flushedUpToRef = useRef<number>(0);
  const ttsQueueRef = useRef<Promise<void>>(Promise.resolve());

  const teardown = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {}
    dcRef.current = null;
    try {
      pcRef.current?.getSenders().forEach((s) => s.track?.stop());
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    try {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    localStreamRef.current = null;
    responseBufRef.current = "";
    flushedUpToRef.current = 0;
    setTranscript("");
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const enqueueTts = useCallback((rawText: string) => {
    const text = respell(rawText.trim());
    if (!text) return;
    ttsQueueRef.current = ttsQueueRef.current
      .then(async () => {
        try {
          const res = await fetch(TTS_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice_id: LILY_VOICE_ID }),
          });
          if (!res.ok) {
            console.error("[mimir-widget] tts failed", res.status);
            return;
          }
          const buf = await res.arrayBuffer();
          const ctx = audioCtxRef.current!;
          const decoded = await ctx.decodeAudioData(buf.slice(0));
          const startAt = Math.max(ctx.currentTime, playStartRef.current);
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(ctx.destination);
          src.start(startAt);
          playStartRef.current = startAt + decoded.duration;
          await new Promise<void>((resolve) => {
            src.onended = () => resolve();
          });
        } catch (e) {
          console.error("[mimir-widget] tts pipeline error", e);
        }
      });
  }, []);

  const flushSentences = useCallback(
    (final: boolean) => {
      const buf = responseBufRef.current;
      let cursor = flushedUpToRef.current;
      const boundary = /[.!?]["')\]]?(\s|$)/g;
      boundary.lastIndex = cursor;
      let lastEnd = cursor;
      let m: RegExpExecArray | null;
      while ((m = boundary.exec(buf)) !== null) {
        const end = m.index + m[0].length;
        const segment = buf.slice(lastEnd, end).trim();
        if (segment) enqueueTts(segment);
        lastEnd = end;
      }
      flushedUpToRef.current = lastEnd;
      if (final && lastEnd < buf.length) {
        const tail = buf.slice(lastEnd).trim();
        if (tail) enqueueTts(tail);
        flushedUpToRef.current = buf.length;
      }
    },
    [enqueueTts],
  );

  const handleEvent = useCallback(
    (evt: any) => {
      switch (evt.type) {
        case "input_audio_buffer.speech_started":
          setStatus("thinking");
          break;
        case "response.created":
          responseBufRef.current = "";
          flushedUpToRef.current = 0;
          playStartRef.current = 0;
          setTranscript("");
          setStatus("speaking");
          break;
        case "response.output_text.delta":
        case "response.text.delta": {
          const delta = typeof evt.delta === "string" ? evt.delta : "";
          if (delta) {
            responseBufRef.current += delta;
            setTranscript(responseBufRef.current);
            flushSentences(false);
          }
          break;
        }
        case "response.output_text.done":
        case "response.text.done":
        case "response.done":
          flushSentences(true);
          setStatus("listening");
          break;
        case "error":
          console.error("[mimir-widget] realtime error", evt);
          setErrorMsg(evt.error?.message || "Realtime error");
          setStatus("error");
          break;
      }
    },
    [flushSentences],
  );

  const start = useCallback(async () => {
    if (status !== "idle" && status !== "error") return;
    setErrorMsg("");
    setStatus("connecting");
    try {
      const sessionRes = await fetch(SESSION_ENDPOINT, { method: "POST" });
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}));
        throw new Error(body.error || `session ${sessionRes.status}`);
      }
      const session = await sessionRes.json();
      const ephemeral = session?.value;
      const model = session?.session?.model || "gpt-realtime-2";
      if (!ephemeral) throw new Error("no client_secret");

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        try { await ctx.resume(); } catch {}
      }

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          handleEvent(evt);
        } catch (err) {
          console.error("[mimir-widget] bad event", err);
        }
      };
      dc.onopen = () => setStatus("listening");

      pc.ontrack = () => {};

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ephemeral}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      if (!sdpRes.ok) {
        const txt = await sdpRes.text().catch(() => "");
        throw new Error(`sdp ${sdpRes.status}: ${txt.slice(0, 200)}`);
      }
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
    } catch (e: any) {
      console.error("[mimir-widget] start failed", e);
      setErrorMsg(e?.message || "Failed to start");
      setStatus("error");
      teardown();
    }
  }, [status, handleEvent, teardown]);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  const onClick = useCallback(() => {
    if (status === "idle" || status === "error") start();
    else stop();
  }, [status, start, stop]);

  const active = status !== "idle" && status !== "error";

  const label = (() => {
    switch (status) {
      case "connecting": return "Connecting...";
      case "listening": return "Listening";
      case "thinking": return "Thinking";
      case "speaking": return "Speaking";
      case "error": return "Tap to retry";
      default: return "Ask Mimir";
    }
  })();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {transcript && active && (
        <div
          className="max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg"
          style={{
            background: "oklch(0.10 0.03 218 / 0.92)",
            color: "oklch(0.92 0.02 80)",
            backdropFilter: "blur(8px)",
            boxShadow: "inset 0 0 0 1px oklch(0.78 0.16 70 / 0.30), 0 12px 32px -8px oklch(0.05 0.02 220 / 0.7)",
          }}
        >
          {transcript}
        </div>
      )}
      {errorMsg && status === "error" && (
        <div
          className="max-w-xs rounded-xl px-3 py-2 text-xs"
          style={{ background: "oklch(0.20 0.10 25 / 0.7)", color: "oklch(0.92 0.04 60)" }}
        >
          {errorMsg}
        </div>
      )}
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="group relative flex items-center gap-3 rounded-full px-5 py-3 text-sm font-semibold transition-all duration-300 hover:scale-[1.03]"
        style={{
          background: active
            ? "oklch(0.84 0.16 75)"
            : "oklch(0.10 0.03 218 / 0.85)",
          color: active ? "oklch(0.10 0.04 220)" : "oklch(0.92 0.02 80)",
          boxShadow: active
            ? "0 0 0 1px oklch(0.84 0.16 75 / 0.6), 0 0 32px oklch(0.78 0.16 70 / 0.5)"
            : "inset 0 0 0 1px oklch(0.78 0.16 70 / 0.35), 0 8px 24px -8px oklch(0.05 0.02 220 / 0.8)",
          backdropFilter: active ? undefined : "blur(8px)",
        }}
      >
        {status === "connecting" ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : active ? (
          <Mic className="h-5 w-5" />
        ) : status === "error" ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
        <span>{label}</span>
        {status === "listening" && (
          <span
            className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full"
            style={{
              background: "oklch(0.78 0.20 30)",
              boxShadow: "0 0 12px oklch(0.78 0.20 30 / 0.9)",
              animation: "pulse 1.6s ease-in-out infinite",
            }}
          />
        )}
      </button>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }`}</style>
    </div>
  );
}
