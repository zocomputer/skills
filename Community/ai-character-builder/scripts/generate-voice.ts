#!/usr/bin/env bun
/**
 * AI Character Builder - Voice Config Generator
 * Generates voice configuration recommendations for TTS providers
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";

interface CharacterIdentity {
  name: string;
  niche: string;
  audience: string;
  personality: {
    tone: string;
    humor: string;
    formality: string;
  };
}

interface VoiceConfig {
  provider: string;
  character_name: string;
  recommended_voices: {
    name: string;
    id: string;
    reason: string;
    sample_text: string;
  }[];
  settings: {
    stability: number;
    similarity_boost: number;
    style: number;
    speed: number;
  };
  voice_profile: {
    gender: string;
    age_range: string;
    accent: string;
    tone_qualities: string[];
  };
  generated_at: string;
}

const PROVIDER_VOICES: Record<string, Array<{ name: string; id: string; gender: string; age: string; qualities: string[] }>> = {
  elevenlabs: [
    { name: "Rachel", id: "21m00Tcm4TlvDq8ikWAM", gender: "female", age: "young adult", qualities: ["calm", "professional", "versatile"] },
    { name: "Domi", id: "AZnzlk1XvdvUeBnXmlld", gender: "female", age: "adult", qualities: ["strong", "energetic", "confident"] },
    { name: "Bella", id: "EXAVITQu4vr4xnSDxMaL", gender: "female", age: "young", qualities: ["soft", "gentle", "warm"] },
    { name: "Antoni", id: "ErXwobaYiN019PkySvjV", gender: "male", age: "adult", qualities: ["well-rounded", "natural", "conversational"] },
    { name: "Elli", id: "MF3mGyEYCl7XYWbV9V6O", gender: "female", age: "young", qualities: ["friendly", "approachable", "casual"] },
    { name: "Josh", id: "TxGEqnHWrfWFTfGW9XjX", gender: "male", age: "young adult", qualities: ["warm", "friendly", "trustworthy"] },
    { name: "Arnold", id: "VR6AewLTigWG4xSOukaG", gender: "male", age: "mature", qualities: ["authoritative", "deep", "storyteller"] },
    { name: "Adam", id: "pNInz6obpgDQGcFmaJgB", gender: "male", age: "adult", qualities: ["energetic", "clear", "engaging"] },
    { name: "Sam", id: "yoZ06aMxZJJ28mfd3POQ", gender: "male", age: "adult", qualities: ["professional", "neutral", "versatile"] },
    { name: "Nicole", id: "piTKgcLEGmPE4e6mEKli", gender: "female", age: "adult", qualities: ["soft", "pleasant", "calm"] }
  ],
  azure: [
    { name: "Jenny", id: "en-US-JennyNeural", gender: "female", age: "adult", qualities: ["friendly", "professional", "versatile"] },
    { name: "Guy", id: "en-US-GuyNeural", gender: "male", age: "adult", qualities: [ "professional", "confident", "clear"] },
    { name: "Aria", id: "en-US-AriaNeural", gender: "female", age: "adult", qualities: ["professional", "confident", "energetic"] },
    { name: "Davis", id: "en-US-DavisNeural", gender: "male", age: "adult", qualities: [ "casual", "friendly", "natural"] },
    { name: "Amber", id: "en-US-AmberNeural", gender: "female", age: "adult", qualities: ["warm", "conversational", "approachable"] }
  ],
  "amazon-polly": [
    { name: "Joanna", id: "Joanna", gender: "female", age: "adult", qualities: ["professional", "natural", "versatile"] },
    { name: "Matthew", id: "Matthew", gender: "male", age: "adult", qualities: ["professional", "news anchor", "clear"] },
    { name: "Ivy", id: "Ivy", gender: "female", age: "child", qualities: ["youthful", "energetic", "friendly"] },
    { name: "Joey", id: "Joey", gender: "male", age: "young adult", qualities: ["casual", "friendly", "natural"] },
    { name: "Kendra", id: "Kendra", gender: "female", age: "adult", qualities: ["warm", "conversational", "approachable"] }
  ]
};

function matchVoicesToCharacter(identity: CharacterIdentity, provider: string): VoiceConfig['recommended_voices'] {
  const voices = PROVIDER_VOICES[provider] || PROVIDER_VOICES.elevenlabs;
  const { tone, formality } = identity.personality;
  
  // Score each voice based on character personality
  const scored = voices.map(voice => {
    let score = 0;
    
    // Match tone qualities
    if (tone.includes('professional') && voice.qualities.includes('professional')) score += 2;
    if (tone.includes('friendly') && voice.qualities.includes('friendly')) score += 2;
    if (tone.includes('energetic') && voice.qualities.includes('energetic')) score += 2;
    if (tone.includes('calm') && voice.qualities.includes('calm')) score += 2;
    if (tone.includes('authoritative') && voice.qualities.includes('authoritative')) score += 2;
    
    // Match formality
    if (formality.includes('casual') && voice.qualities.includes('casual')) score += 1;
    if (formality.includes('professional') && voice.qualities.includes('professional')) score += 1;
    
    return { voice, score };
  });
  
  // Sort by score and take top 3
  const topVoices = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ voice }) => ({
      name: voice.name,
      id: voice.id,
      reason: `Matches ${identity.personality.tone} tone with ${voice.qualities.join(', ')} qualities`,
      sample_text: `Hi, I'm ${identity.name}. I'm here to share insights about ${identity.niche} that will help ${identity.audience} achieve their goals.`
    }));
  
  return topVoices;
}

function generateSettings(personality: CharacterIdentity['personality']): VoiceConfig['settings'] {
  const { tone, formality } = personality;
  
  return {
    // Higher stability for professional/formal, lower for energetic/casual
    stability: formality.includes('professional') ? 0.7 : 0.5,
    
    // Boost similarity for consistent character voice
    similarity_boost: 0.75,
    
    // Style emphasis based on tone
    style: tone.includes('energetic') ? 0.6 : tone.includes('calm') ? 0.2 : 0.4,
    
    // Speed based on tone
    speed: tone.includes('energetic') ? 1.1 : tone.includes('calm') ? 0.95 : 1.0
  };
}

function generateVoiceProfile(identity: CharacterIdentity): VoiceConfig['voice_profile'] {
  const { personality } = identity;
  
  // Determine gender based on name (simple heuristic)
  const nameLower = identity.name.toLowerCase();
  const femaleNames = ['aria', 'bella', 'jenny', 'sarah', 'emma', 'olivia', 'ava', 'sophia', 'nicole', 'rachel', 'ella', 'luna'];
  const isFemale = femaleNames.some(n => nameLower.includes(n));
  
  // Determine age range from visual style or default
  const ageRange = '25-40'; // Default, could be extracted from identity
  
  // Determine accent (default to neutral American)
  const accent = 'Neutral American';
  
  // Extract tone qualities
  const toneQualities = [
    personality.tone.split(' ')[0],
    personality.formality.split(' ')[0],
    ...personality.humor.split(',').map(h => h.trim()).slice(0, 2)
  ].filter(Boolean);
  
  return {
    gender: isFemale ? 'female' : 'male',
    age_range: ageRange,
    accent,
    tone_qualities: toneQualities
  };
}

async function generateVoiceConfig(options: {
  identity?: string;
  provider?: string;
  output?: string;
}): Promise<void> {
  const { identity, provider = 'elevenlabs', output } = options;
  
  if (!identity) {
    console.error("❌ Error: Identity file path is required");
    console.log("\nUsage:");
    console.log("  bun generate-voice.ts --identity ./my-character.json");
    console.log("  bun generate-voice.ts --identity ./my-character.json --provider elevenlabs");
    console.log("\nProviders: elevenlabs, azure, amazon-polly");
    process.exit(1);
  }
  
  if (!existsSync(identity)) {
    console.error(`❌ Error: Identity file not found: ${identity}`);
    process.exit(1);
  }
  
  // Load identity
  const identityData: CharacterIdentity = JSON.parse(await readFile(identity, 'utf-8'));
  console.log(`🎙️  Generating voice config for: ${identityData.name}\n`);
  
  // Generate voice recommendations
  const recommendedVoices = matchVoicesToCharacter(identityData, provider);
  const settings = generateSettings(identityData.personality);
  const voiceProfile = generateVoiceProfile(identityData);
  
  const config: VoiceConfig = {
    provider,
    character_name: identityData.name,
    recommended_voices: recommendedVoices,
    settings,
    voice_profile: voiceProfile,
    generated_at: new Date().toISOString()
  };
  
  // Output path
  const outputPath = output || `./${identityData.name.toLowerCase().replace(/\s+/g, '-')}-voice-config.json`;
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  
  await writeFile(outputPath, JSON.stringify(config, null, 2));
  
  // Print summary
  console.log("📋 Voice Configuration Summary:\n");
  console.log(`  Provider: ${provider}`);
  console.log(`  Character: ${identityData.name}`);
  console.log(`\n  Voice Profile:`);
  console.log(`    Gender: ${voiceProfile.gender}`);
  console.log(`    Age Range: ${voiceProfile.age_range}`);
  console.log(`    Accent: ${voiceProfile.accent}`);
  console.log(`    Qualities: ${voiceProfile.tone_qualities.join(', ')}`);
  console.log(`\n  Recommended Voices:`);
  recommendedVoices.forEach((voice, idx) => {
    console.log(`    ${idx + 1}. ${voice.name} (${voice.id})`);
    console.log(`       Reason: ${voice.reason}`);
    console.log(`       Sample: "${voice.sample_text}"`);
    console.log();
  });
  console.log(`  Settings:`);
  console.log(`    Stability: ${settings.stability}`);
  console.log(`    Similarity Boost: ${settings.similarity_boost}`);
  console.log(`    Style: ${settings.style}`);
  console.log(`    Speed: ${settings.speed}`);
  console.log(`\n💾 Configuration saved: ${outputPath}`);
  
  // Provider-specific notes
  console.log(`\n💡 ${provider} Setup Notes:`);
  switch (provider) {
    case 'elevenlabs':
      console.log("  1. Get API key at: https://elevenlabs.io/subscription");
      console.log("  2. Set ELEVENLABS_API_KEY in your environment");
      console.log("  3. Test voice: curl with the voice ID from the config");
      break;
    case 'azure':
      console.log("  1. Create Azure Speech resource in Azure Portal");
      console.log("  2. Get region and key from the resource");
      console.log("  3. Use Azure SDK or REST API with the voice IDs above");
      break;
    case 'amazon-polly':
      console.log("  1. Set up AWS credentials with Polly access");
      console.log("  2. Use AWS CLI or SDK to synthesize speech");
      console.log("  3. Voice IDs work directly with Polly API");
      break;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++;
    }
  }
}

generateVoiceConfig({
  identity: options.identity,
  provider: options.provider,
  output: options.output
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
