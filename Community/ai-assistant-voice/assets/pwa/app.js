/**
 * persona-voice PWA — app.js
 * Generic voice interface for any Zo persona.
 * Speech → zo.space proxy → Zo API → response → TTS proxy → audio playback.
 * Configure only your zo.space host URL — all credentials stay server-side.
 * Falls back to browser Web Speech API if TTS unavailable.
 */

'use strict';

// Built-in voice presets (ElevenLabs voice IDs)
const VOICE_PRESETS = {
  Antoni: 'ErXwobaYiN019PkySvjV',
  Rachel: '21m00Tcm4TlvDq8ikWAM',
  Bella:  'EXAVITQu4vr4xnSDxMaL',
  Grace:  'Yko7PKHZNXotIFUBG7I9',
};

// localStorage key prefix — namespaced to avoid collisions
const NS = 'pv_';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  zoHost:         localStorage.getItem(`${NS}zo_host`)          || '',
  personaId:      localStorage.getItem(`${NS}persona_id`)       || '',
  assistantName:  localStorage.getItem(`${NS}assistant_name`)   || 'Assistant',
  voiceName:      localStorage.getItem(`${NS}voice_name`)       || 'Antoni',
  voiceId:        localStorage.getItem(`${NS}voice_id`)         || VOICE_PRESETS.Antoni,
  conversationId: localStorage.getItem(`${NS}conversation_id`)  || null,
  messages:       [],
  isRecording:    false,
  isSpeaking:     false,
  isTyping:       false,
  settingsOpen:   false,
  speechRec:      null,
};

// Derive proxy endpoints from the configured host
function askEndpoint()  { return state.zoHost ? `${state.zoHost}/api/zo-ask` : null; }
function ttsEndpoint()  { return state.zoHost ? `${state.zoHost}/api/tts`    : null; }

// Normalise host: ensure https:// prefix, strip trailing slash
function normaliseHost(raw) {
  let h = raw.trim();
  if (!h) return '';
  if (!h.startsWith('http')) h = `https://${h}`;
  return h.replace(/\/$/, '');
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Utilities ────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info', duration = 3000) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => { el.className = 'toast'; }, duration);
}

function avatarInitial() {
  return (state.assistantName || 'A')[0].toUpperCase();
}

function updateHeader() {
  const title = $('#assistant-title');
  const sub   = $('#assistant-subtitle');
  if (title) title.textContent = state.assistantName || 'Voice AI';
  if (sub)   sub.textContent   = 'AI Assistant';
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadSettings() {
  state.zoHost        = localStorage.getItem(`${NS}zo_host`)         || '';
  state.personaId     = localStorage.getItem(`${NS}persona_id`)      || '';
  state.assistantName = localStorage.getItem(`${NS}assistant_name`)  || 'Assistant';
  state.voiceName     = localStorage.getItem(`${NS}voice_name`)      || 'Antoni';
  state.voiceId       = localStorage.getItem(`${NS}voice_id`)        || VOICE_PRESETS.Antoni;
}

function openSettings() {
  const sheet = $('#settings-sheet');
  sheet.classList.add('open');
  $('#zo-host-input').value        = state.zoHost;
  $('#persona-id-input').value     = state.personaId;
  $('#assistant-name-input').value = state.assistantName;
  $('#voice-select').value         = state.voiceName;
  state.settingsOpen = true;
}

function closeSettings() {
  $('#settings-sheet').classList.remove('open');
  state.settingsOpen = false;
}

async function saveSettings() {
  const zoHost        = normaliseHost($('#zo-host-input').value);
  const personaId     = $('#persona-id-input').value.trim();
  const assistantName = $('#assistant-name-input').value.trim() || 'Assistant';
  const voiceName     = $('#voice-select').value;

  if (!zoHost) {
    const msg = $('#status-msg');
    msg.textContent = '⚠️  Zo Space host is required.';
    msg.className = 'status-msg error';
    return;
  }

  state.zoHost        = zoHost;
  state.personaId     = personaId;
  state.assistantName = assistantName;
  state.voiceName     = voiceName;
  state.voiceId       = VOICE_PRESETS[voiceName] || voiceName;

  localStorage.setItem(`${NS}zo_host`,        zoHost);
  localStorage.setItem(`${NS}persona_id`,     personaId);
  localStorage.setItem(`${NS}assistant_name`, assistantName);
  localStorage.setItem(`${NS}voice_name`,     voiceName);
  localStorage.setItem(`${NS}voice_id`,       state.voiceId);

  updateHeader();

  const msg = $('#status-msg');
  msg.textContent = '✅ Settings saved.';
  msg.className = 'status-msg success';
  setTimeout(() => { closeSettings(); showConfigBanner(); }, 800);
}

// ─── Config banner ────────────────────────────────────────────────────────────
function showConfigBanner() {
  const banner = $('#config-banner');
  if (banner) banner.style.display = state.zoHost ? 'none' : '';
}

// ─── Conversation rendering ───────────────────────────────────────────────────
function scrollToBottom() {
  const el = $('#conversation');
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function renderMessages() {
  const container = $('#conversation');
  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </div>
        <h3>Ready to listen</h3>
        <p>Tap the mic to speak, or type a message below.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.messages.map((m) => {
    const role   = m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'assistant';
    const avatar =
      role === 'user'   ? `<div class="avatar user-avatar">${m.name ? m.name[0] : 'U'}</div>` :
      role === 'system' ? `<div class="avatar system-avatar">⚡</div>` :
                          `<div class="avatar assistant">${avatarInitial()}</div>`;
    return `
      <div class="message ${role}">
        ${avatar}
        <div class="bubble-wrap">
          <div class="bubble">${m.text}</div>
          <span class="timestamp">${m.time || ''}</span>
        </div>
      </div>`;
  }).join('');

  scrollToBottom();
}

function addMessage(role, text, name) {
  state.messages.push({ role, text, time: ts(), name: name || '' });
  renderMessages();
}

function setTyping(visible) {
  const container = $('#conversation');
  let el = $('#typing-indicator');
  if (visible) {
    if (!el) {
      container.insertAdjacentHTML('beforeend', `
        <div class="typing-wrap" id="typing-indicator">
          <div class="avatar assistant" style="flex-shrink:0">${avatarInitial()}</div>
          <div class="typing-bubble">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>`);
    }
  } else {
    if (el) el.remove();
  }
  state.isTyping = visible;
  scrollToBottom();
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
async function speakText(text) {
  if (!text) return;
  const endpoint = ttsEndpoint();
  if (!endpoint) { await browserTTS(text); return; }

  state.isSpeaking = true;
  updateMicButton();

  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice_id: state.voiceId }),
    });

    if (!resp.ok) throw new Error(`TTS ${resp.status}`);

    const blob  = await resp.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = audio.onerror = () => {
      URL.revokeObjectURL(url);
      state.isSpeaking = false;
      updateMicButton();
    };

    await audio.play();

  } catch (err) {
    console.warn('[TTS] Failed, falling back to browser TTS:', err);
    await browserTTS(text);
    state.isSpeaking = false;
    updateMicButton();
  }
}

async function browserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0; utter.pitch = 1.0;
  return new Promise((resolve) => {
    utter.onend = utter.onerror = resolve;
    speechSynthesis.speak(utter);
  });
}

// ─── Speech recognition ───────────────────────────────────────────────────────
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US';

  rec.onresult = (e) => {
    const result = e.results[e.results.length - 1];
    const t = result[0].transcript.trim();
    if (result.isFinal && t) {
      $('#message-input').value = t;
      stopRecording();
      sendMessage();
    }
  };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech') toast('Voice error — try again.', 'error');
    stopRecording();
  };
  rec.onend = () => { if (state.isRecording) stopRecording(); };
  return rec;
}

function startRecording() {
  if (!state.zoHost) { openSettings(); return; }
  if (!state.speechRec) state.speechRec = initSpeechRecognition();
  if (!state.speechRec) { toast('Speech recognition not supported in this browser.', 'error'); return; }
  state.isRecording = true;
  updateMicButton();
  try { state.speechRec.start(); } catch { state.isRecording = false; updateMicButton(); }
}

function stopRecording() {
  state.isRecording = false;
  updateMicButton();
  try { state.speechRec?.stop(); } catch { /* ignore */ }
}

function updateMicButton() {
  const btn = $('#mic-btn');
  if (state.isRecording) {
    btn.classList.add('recording'); btn.classList.remove('speaking');
    btn.title = 'Listening… tap to stop';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  } else if (state.isSpeaking) {
    btn.classList.remove('recording'); btn.classList.add('speaking');
    btn.title = 'Speaking…';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  } else {
    btn.classList.remove('recording', 'speaking');
    btn.title = 'Tap to speak';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  }
}

// ─── Message sending ──────────────────────────────────────────────────────────
async function sendMessage() {
  const text = $('#message-input').value.trim();
  if (!text || state.isTyping) return;
  if (!state.zoHost) { openSettings(); return; }

  const endpoint = askEndpoint();

  $('#message-input').value = '';
  $('#message-input').style.height = 'auto';
  addMessage('user', text);
  setTyping(true);

  try {
    const payload = { input: text };
    if (state.personaId) payload.persona_id = state.personaId;
    if (state.conversationId) payload.conversation_id = state.conversationId;

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 401 || resp.status === 403) {
      setTyping(false);
      toast('Proxy auth error — check ZO_ASK_TOKEN in Zo Secrets.', 'error');
      addMessage('system', 'Authentication failed. Ensure ZO_ASK_TOKEN is set in Zo Settings → Advanced → Secrets.');
      return;
    }

    if (resp.status === 503) {
      setTyping(false);
      toast('Proxy not configured — check Zo Secrets.', 'error');
      addMessage('system', 'ZO_ASK_TOKEN not set. Add it in Zo Settings → Advanced → Secrets and redeploy /api/zo-ask.');
      return;
    }

    if (!resp.ok) throw new Error(`API ${resp.status}`);

    const data = await resp.json();

    if (data.conversation_id) {
      state.conversationId = data.conversation_id;
      localStorage.setItem(`${NS}conversation_id`, data.conversation_id);
    }

    setTyping(false);
    const reply = data.output || "I didn't receive a response. Please try again.";
    addMessage('assistant', reply);
    await speakText(reply);

  } catch (err) {
    console.error('[API]', err);
    setTyping(false);
    toast('Connection error — check your network.', 'error');
    addMessage('system', `Request failed: ${err.message}`);
  }
}

// ─── Settings panel HTML ──────────────────────────────────────────────────────
function buildSettingsPanel() {
  const voiceOptions = Object.keys(VOICE_PRESETS).map(v =>
    `<option value="${v}">${v}</option>`
  ).join('');

  return `
    <div class="settings-backdrop" id="settings-backdrop"></div>
    <div class="settings-panel">
      <div class="settings-title">
        <span>⚙️  Settings</span>
        <button class="settings-close" id="settings-close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="setting-group">
        <label class="setting-label">Zo Space Host</label>
        <input type="text" class="setting-input" id="zo-host-input"
          placeholder="yourhandle.zo.space" autocomplete="off" spellcheck="false"/>
        <p class="setting-hint">
          Your zo.space handle. All credentials stay server-side — this is the only field you need.
          Run <code>deploy-tts-endpoint.ts --deploy-all</code> to set up the proxy routes.
        </p>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-group">
        <label class="setting-label">Persona ID</label>
        <input type="text" class="setting-input" id="persona-id-input"
          placeholder="UUID — e.g. 00000000-0000-0000-0000-000000000000"
          autocomplete="off" spellcheck="false"/>
        <p class="setting-hint">
          Find persona IDs in
          <a href="/?t=settings&s=ai&d=personas" target="_blank">Settings → AI → Personas</a>.
          Leave blank to use your Zo default.
        </p>
      </div>

      <div class="setting-group">
        <label class="setting-label">Assistant Name</label>
        <input type="text" class="setting-input" id="assistant-name-input"
          placeholder="e.g. Alaric" autocomplete="off"/>
        <p class="setting-hint">Displayed in the header and conversation bubbles.</p>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-group">
        <label class="setting-label">Voice</label>
        <select class="setting-select" id="voice-select">${voiceOptions}</select>
        <p class="setting-hint">
          ElevenLabs voice for TTS. Requires <code>ELEVENLABS_API_KEY</code> in
          <a href="/?t=settings&s=advanced" target="_blank">Zo Settings → Advanced → Secrets</a>.
        </p>
      </div>

      <div class="setting-divider"></div>

      <button class="btn-save" id="settings-save">Save Settings</button>
      <div class="status-msg" id="status-msg"></div>
    </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSettings();
  updateHeader();

  const sheet = document.createElement('div');
  sheet.id = 'settings-sheet';
  sheet.className = 'settings-sheet';
  sheet.innerHTML = buildSettingsPanel();
  document.body.appendChild(sheet);

  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-backdrop')?.addEventListener('click', closeSettings);
  $('#settings-save').addEventListener('click', saveSettings);

  $$('.setting-input, .setting-select').forEach(el =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); })
  );

  const mic = $('#mic-btn');
  mic.addEventListener('click', () => { if (state.isRecording) stopRecording(); else startRecording(); });

  let pressTimer;
  mic.addEventListener('touchstart', (e) => { e.preventDefault(); pressTimer = setTimeout(() => startRecording(), 200); }, { passive: false });
  mic.addEventListener('touchend',   (e) => { e.preventDefault(); clearTimeout(pressTimer); if (state.isRecording) stopRecording(); }, { passive: false });
  mic.addEventListener('touchcancel', () => { clearTimeout(pressTimer); stopRecording(); });

  $('#send-btn').addEventListener('click', () => { if ($('#message-input').value.trim()) sendMessage(); });

  $('#message-input').addEventListener('input', () => {
    const el = $('#message-input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    $('#send-btn').disabled = !el.value.trim();
  });

  $('#message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ($('#message-input').value.trim()) sendMessage();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) =>
      console.warn('[SW] Registration failed:', err)
    );
  }

  showConfigBanner();
  renderMessages();

  if (!state.zoHost) {
    setTimeout(() => toast('Welcome! Tap ⚙️ to set your Zo Space host.', 'info', 5000), 500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
