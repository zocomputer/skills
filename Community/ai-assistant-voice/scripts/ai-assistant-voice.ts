#!/usr/bin/env bun
/**
 * persona-voice CLI
 * Manage voice configs for Zo personas and generate ElevenLabs TTS.
 *
 * Commands:
 *   voices                          List available ElevenLabs voices
 *   config set --persona <id> --name <name> --voice <voice-id>
 *   config list                     Show saved persona voice configs
 *   speak <text> --voice <voice-id> [--output <path>]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR  = join(homedir(), '.zo', 'voice');
const CONFIG_FILE = join(CONFIG_DIR, 'persona-voices.json');
const API_KEY     = process.env.ELEVENLABS_API_KEY ?? '';
const BASE_URL    = 'https://api.elevenlabs.io/v1';

interface PersonaConfig {
  id: string;
  name: string;
  voiceId: string;
}

interface ConfigStore {
  personas: PersonaConfig[];
}

function loadConfig(): ConfigStore {
  if (!existsSync(CONFIG_FILE)) return { personas: [] };
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { personas: [] };
  }
}

function saveConfig(store: ConfigStore) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(store, null, 2));
}

function requireKey() {
  if (!API_KEY) {
    console.error('ELEVENLABS_API_KEY is not set. Add it in Settings → Advanced → Secrets.');
    process.exit(1);
  }
}

async function listVoices() {
  requireKey();
  const res = await fetch(`${BASE_URL}/voices`, {
    headers: { 'xi-api-key': API_KEY },
  });
  if (!res.ok) { console.error(`ElevenLabs error: ${res.status} ${await res.text()}`); process.exit(1); }
  const { voices } = await res.json() as { voices: Array<{ voice_id: string; name: string; category: string }> };
  console.log(`\nAvailable voices (${voices.length}):\n`);
  for (const v of voices) {
    console.log(`  ${v.name.padEnd(20)} ${v.voice_id}  [${v.category}]`);
  }
}

async function speak(text: string, voiceId: string, outputPath?: string) {
  requireKey();
  const res = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_flash_v2_5',
      voice_settings: { stability: 0.85, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) { console.error(`TTS error: ${res.status} ${await res.text()}`); process.exit(1); }

  const out = outputPath ?? join(CONFIG_DIR, `output-${Date.now()}.mp3`);
  mkdirSync(CONFIG_DIR, { recursive: true });
  const buf = await res.arrayBuffer();
  writeFileSync(out, Buffer.from(buf));
  console.log(`Audio saved: ${out}`);
}

const args = process.argv.slice(2);
const cmd  = args[0];

function flag(name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i !== -1 ? args[i + 1] : undefined;
}

if (cmd === 'voices') {
  await listVoices();

} else if (cmd === 'config' && args[1] === 'set') {
  const personaId = flag('persona');
  const name      = flag('name');
  const voiceId   = flag('voice');
  if (!personaId || !name || !voiceId) {
    console.error('Usage: config set --persona <id> --name <name> --voice <voice-id>');
    process.exit(1);
  }
  const store = loadConfig();
  const existing = store.personas.findIndex(p => p.id === personaId);
  const entry = { id: personaId, name, voiceId };
  if (existing >= 0) store.personas[existing] = entry;
  else store.personas.push(entry);
  saveConfig(store);
  console.log(`Saved: ${name} → ${voiceId}`);

} else if (cmd === 'config' && args[1] === 'list') {
  const store = loadConfig();
  if (store.personas.length === 0) { console.log('No persona voice configs saved.'); }
  else {
    console.log('\nSaved persona voice configs:\n');
    for (const p of store.personas) {
      console.log(`  ${p.name.padEnd(20)} persona=${p.id}  voice=${p.voiceId}`);
    }
  }

} else if (cmd === 'speak') {
  const text    = args[1];
  const voiceId = flag('voice');
  const output  = flag('output');
  if (!text || !voiceId) {
    console.error('Usage: speak "<text>" --voice <voice-id> [--output <path>]');
    process.exit(1);
  }
  await speak(text, voiceId, output);

} else {
  console.log(`
persona-voice — Generic voice interface for Zo personas

Commands:
  voices                           List available ElevenLabs voices
  config set --persona <id> \\
             --name <name> \\
             --voice <voice-id>    Save a persona voice config
  config list                      Show saved configs
  speak "<text>" --voice <id> \\
         [--output <path>]         Generate TTS audio

Requires: ELEVENLABS_API_KEY in Settings → Advanced → Secrets
  `);
}
