import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX } from "lucide-react";

type Status = "idle" | "listening" | "thinking" | "speaking" | "error";

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

function getSpeechRecognition(): typeof SpeechRecognition | null {
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

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

function selectBestVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer: British female > any female > British > default
  const britFemale = voices.find(
    (v) => /en-GB|en-GB/.test(v.lang) && /female/i.test(v.name)
  );
  if (britFemale) return britFemale;
  const anyFemale = voices.find(
    (v) => /female/i.test(v.name) && v.lang.startsWith("en")
  );
  if (anyFemale) return anyFemale;
  const brit = voices.find((v) => /en-GB|en-GB/.test(v.lang));
  if (brit) return brit;
  const en = voices.find((v) => v.lang.startsWith("en"));
  return en || voices[0];
}

export default function MimirMicWidgetBrowser() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [transcript, setTranscript] = useState<string>("");
  const [mimirSays, setMimirSays] = useState<string>("");
  const [muted, setMuted] = useState(false);

  const recRef = useRef<SpeechRecognition | null>(null);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const queuedTextRef = useRef<string>("");

  const teardown = useCallback(() => {
    try {
      recRef.current?.abort();
    } catch {}
    recRef.current = null;
    abortCtrlRef.current?.abort();
    abortCtrlRef.current = null;
    window.speechSynthesis.cancel();
    queuedTextRef.current = "";
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const speak = useCallback((text: string) => {
    if (muted || !text) return;
    const voice = selectBestVoice();
    const u = new SpeechSynthesisUtterance(respell(text));
    u.voice = voice;
    u.rate = 1.05;
    u.pitch = 0.95;
    u.lang = voice?.lang || "en-GB";
    u.onstart = () => setStatus("speaking");
    u.onend = () => setStatus("listening");
    u.onerror = () => setStatus("idle");
    window.speechSynthesis.speak(u);
  }, [muted]);

  const sendToMimir = useCallback(async (text: string) => {
    setStatus("thinking");
    abortCtrlRef.current = new AbortController();
    try {
      const res = await fetch("https://api.zo.computer/zo/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          input: text,
          persona_id: "edb62603-779c-4e8e-bbcd-33f5126212e1",
          model_name: "byok:463350ac-4a49-4ceb-8653-042ecffa513f",
          conversation_id: null,
        }),
        signal: abortCtrlRef.current.signal,
      });
      if (!res.ok) throw new Error(`Zo API ${res.status}`);
      const data = await res.json();
      const reply =
        typeof data.output === "string"
          ? data.output
          : data.output?.result || "The well gave no voice.";
      setMimirSays(reply);
      speak(reply);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      console.error("[mimir-browser] ask failed", e);
      setErrorMsg(e?.message || "The well is quiet.");
      setStatus("error");
    }
  }, [speak]);

  const startListening = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setErrorMsg("Your browser does not support speech recognition.");
      setStatus("error");
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setStatus("listening");
      setTranscript("");
      setMimirSays("");
      setErrorMsg("");
    };
    rec.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final) queuedTextRef.current = final;
    };
    rec.onerror = (event: any) => {
      const harmless = ["no-speech", "aborted", "audio-capture"];
      if (!harmless.includes(event.error)) {
        console.error("[mimir-browser] recognition error", event.error);
        setErrorMsg(`Mic error: ${event.error}`);
        setStatus("error");
      }
    };
    rec.onend = () => {
      const text = queuedTextRef.current.trim();
      if (text) {
        queuedTextRef.current = "";
        sendToMimir(text);
      } else {
        setStatus("idle");
      }
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      setErrorMsg("Microphone unavailable.");
      setStatus("error");
    }
  }, [sendToMimir]);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    teardown();
    setStatus("idle");
  }, [teardown]);

  const onClick = useCallback(() => {
    if (status === "idle" || status === "error") {
      startListening();
    } else {
      stop();
    }
  }, [status, startListening, stop]);

  const active = status !== "idle" && status !== "error";

  const label = (() => {
    switch (status) {
      case "listening": return "Listening";
      case "thinking": return "Thinking";
      case "speaking": return "Speaking";
      case "error": return "Tap to retry";
      default: return "Ask Mimir";
    }
  })();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {(transcript || mimirSays) && active && (
        <div
          className="max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg"
          style={{
            background: "oklch(0.10 0.03 218 / 0.92)",
            color: "oklch(0.92 0.02 80)",
            backdropFilter: "blur(8px)",
            boxShadow: "inset 0 0 0 1px oklch(0.78 0.16 70 / 0.30), 0 12px 32px -8px oklch(0.05 0.02 220 / 0.7)",
          }}
        >
          {transcript && (
            <div className="opacity-60 mb-1 italic">You: {transcript}</div>
          )}
          {mimirSays}
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
      <div className="flex items-center gap-2">
        {active && (
          <button
            type="button"
            onClick={() => {
              setMuted((m) => {
                const next = !m;
                if (next) window.speechSynthesis.cancel();
                return next;
              });
            }}
            className="rounded-full p-2 text-xs"
            style={{
              background: "oklch(0.10 0.03 218 / 0.85)",
              color: "oklch(0.92 0.02 80)",
              boxShadow: "inset 0 0 0 1px oklch(0.78 0.16 70 / 0.35)",
            }}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
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
          {status === "thinking" ? (
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
      </div>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }`}</style>
    </div>
  );
}
