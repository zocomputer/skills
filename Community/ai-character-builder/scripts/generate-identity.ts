#!/usr/bin/env bun
/**
 * AI Character Builder - Identity Generator
 * Creates character identity profiles with AI-enhanced backstories
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname } from "path";

interface CharacterIdentity {
  id: string;
  name: string;
  niche: string;
  audience: string;
  backstory: string;
  values: string[];
  personality: {
    tone: string;
    humor: string;
    formality: string;
  };
  visual: {
    style: string;
    age_range: string;
    aesthetic: string;
  };
  prompts: {
    midjourney: string;
    stable_diffusion: string;
  };
  created_at: string;
}

function generateId(): string {
  return `char_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`;
}

function generateBackstory(name: string, niche: string, audience: string, values: string[]): string {
  const templates = [
    `${name} emerged from the intersection of ${niche} and authentic human connection. After years of observing how ${audience} struggled to find trustworthy guidance, they decided to become the voice they wished they had. Driven by ${values.join(', ')}, ${name} now creates content that educates while entertaining.`,
    
    `Born from a passion for ${niche}, ${name} spent years in the trenches before stepping into the spotlight. Their journey wasn't about becoming famous—it was about serving ${audience} with unwavering commitment to ${values[0] || 'authenticity'}. Every piece of content reflects their core belief that knowledge should be accessible to all.`,
    
    `${name} isn't just another voice in the ${niche} space. They're a disruptor who saw ${audience} being underserved and decided to do something about it. With ${values.join(' and ')} as their north star, they've built a community around honest, no-BS guidance that actually works.`,
    
    `The ${niche} world needed someone like ${name}. Not another guru, but a genuine guide who understands ${audience} because they've lived the same struggles. Their commitment to ${values[0] || 'transparency'} and ${values[1] || 'quality'} has made them a trusted voice in a noisy space.`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateVisualStyle(niche: string): { style: string; age_range: string; aesthetic: string } {
  const nicheStyles: Record<string, { style: string; age_range: string; aesthetic: string }> = {
    "tech": { style: "modern minimal", age_range: "25-35", aesthetic: "clean lines, neutral colors, tech-forward" },
    "fashion": { style: "trendy editorial", age_range: "20-30", aesthetic: "high-contrast, bold colors, magazine-quality" },
    "fitness": { style: "athletic lifestyle", age_range: "25-40", aesthetic: "dynamic lighting, energetic, aspirational" },
    "food": { style: "warm documentary", age_range: "30-45", aesthetic: "natural lighting, rustic textures, inviting" },
    "travel": { style: "cinematic landscape", age_range: "25-35", aesthetic: "golden hour, wanderlust vibes, immersive" },
    "finance": { style: "professional modern", age_range: "30-50", aesthetic: "clean, trustworthy, sophisticated" },
    "gaming": { style: "neon cyberpunk", age_range: "18-30", aesthetic: "RGB lighting, futuristic, high-energy" },
    "education": { style: "approachable expert", age_range: "28-45", aesthetic: "warm, accessible, knowledgeable" }
  };
  
  const key = Object.keys(nicheStyles).find(k => niche.toLowerCase().includes(k)) || "general";
  return nicheStyles[key] || { style: "versatile contemporary", age_range: "25-40", aesthetic: "adaptable, professional, engaging" };
}

function generatePrompts(name: string, niche: string, visual: { style: string; aesthetic: string }): { midjourney: string; stable_diffusion: string } {
  const midjourney = `Portrait of ${name}, a ${niche} content creator, ${visual.style} style, ${visual.aesthetic}, professional headshot, 85mm lens, f/1.8, soft studio lighting, highly detailed, 8k quality, consistent character --ar 2:3 --style raw`;
  
  const stable_diffusion = `portrait of ${name}, ${niche} expert, ${visual.aesthetic}, professional photography, soft lighting, sharp focus, 8k uhd, dslr, high quality, film grain, Fujifilm XT3`;
  
  return { midjourney, stable_diffusion };
}

function generatePersonality(niche: string): { tone: string; humor: string; formality: string } {
  const personalities: Record<string, { tone: string; humor: string; formality: string }> = {
    "tech": { tone: "curious and explanatory", humor: "witty, meme-aware", formality: "casual professional" },
    "finance": { tone: "authoritative but accessible", humor: "dry, occasional", formality: "professional" },
    "fitness": { tone: "motivational and direct", humor: "energetic, light", formality: "casual" },
    "fashion": { tone: "confident and aspirational", humor: "playful, trendy", formality: "stylish casual" },
    "gaming": { tone: "enthusiastic and relatable", humor: "meme-heavy, self-deprecating", formality: "very casual" },
    "education": { tone: "patient and encouraging", humor: "gentle, contextual", formality: "accessible professional" }
  };
  
  const key = Object.keys(personalities).find(k => niche.toLowerCase().includes(k)) || "general";
  return personalities[key] || { tone: "friendly and informative", humor: "occasional, situational", formality: "casual professional" };
}

async function promptInput(query: string): Promise<string> {
  process.stdout.write(`${query}: `);
  const result = await new Promise<string>((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
  return result;
}

async function generateIdentity(options: {
  name?: string;
  niche?: string;
  audience?: string;
  values?: string;
  output?: string;
  interactive?: boolean;
  extractPrompt?: boolean;
}): Promise<void> {
  let { name, niche, audience, values, output, interactive, extractPrompt } = options;
  
  if (interactive) {
    console.log("🎭 AI Character Builder - Identity Generator\n");
    console.log("Let's create your character's identity. Press Ctrl+C to cancel at any time.\n");
    
    name = await promptInput("Character name");
    niche = await promptInput("Niche/topic (e.g., 'Sustainable Tech', 'Fitness for Busy Professionals')");
    audience = await promptInput("Target audience (e.g., 'Gen Z developers', 'working moms')");
    values = await promptInput("Core values, comma-separated (e.g., 'Transparency, Humor, Quality')");
    
    if (!output) {
      const defaultOutput = `./${name?.toLowerCase().replace(/\s+/g, '-')}-character.json`;
      const outputInput = await promptInput(`Output file path [${defaultOutput}]`);
      output = outputInput || defaultOutput;
    }
  }
  
  if (!name || !niche) {
    console.error("❌ Error: Name and niche are required");
    console.log("\nUsage:");
    console.log("  Interactive mode: bun generate-identity.ts --interactive");
    console.log("  Command line:     bun generate-identity.ts --name 'Aria' --niche 'Tech'");
    process.exit(1);
  }
  
  const valuesArray = values?.split(',').map(v => v.trim()).filter(Boolean) || ['Authenticity', 'Quality'];
  const visual = generateVisualStyle(niche);
  const personality = generatePersonality(niche);
  const backstory = generateBackstory(name, niche, audience || 'the community', valuesArray);
  const prompts = generatePrompts(name, niche, visual);
  
  const identity: CharacterIdentity = {
    id: generateId(),
    name,
    niche,
    audience: audience || 'general audience',
    backstory,
    values: valuesArray,
    personality,
    visual,
    prompts,
    created_at: new Date().toISOString()
  };
  
  if (extractPrompt) {
    console.log(prompts.midjourney);
    return;
  }
  
  // Ensure output directory exists
  if (output) {
    const dir = dirname(output);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(output, JSON.stringify(identity, null, 2));
    console.log(`✅ Character identity saved to: ${output}`);
  }
  
  // Always print summary
  console.log("\n📋 Character Identity Summary:\n");
  console.log(`  Name:      ${identity.name}`);
  console.log(`  Niche:     ${identity.niche}`);
  console.log(`  Audience:  ${identity.audience}`);
  console.log(`  Values:    ${identity.values.join(', ')}`);
  console.log(`\n  Personality:`);
  console.log(`    Tone:     ${identity.personality.tone}`);
  console.log(`    Humor:    ${identity.personality.humor}`);
  console.log(`    Formality: ${identity.personality.formality}`);
  console.log(`\n  Visual Style:`);
  console.log(`    Style:     ${identity.visual.style}`);
  console.log(`    Age Range: ${identity.visual.age_range}`);
  console.log(`    Aesthetic: ${identity.visual.aesthetic}`);
  console.log(`\n  🎨 Image Prompts:`);
  console.log(`    Midjourney: ${identity.prompts.midjourney}`);
  console.log(`    Stable Diffusion: ${identity.prompts.stable_diffusion}`);
  console.log(`\n  📝 Backstory Preview:`);
  console.log(`    ${identity.backstory.slice(0, 120)}...`);
  
  if (!output) {
    console.log("\n💡 Tip: Use --output ./my-character.json to save this identity");
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string | boolean> = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const nextArg = args[i + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      options[key] = nextArg;
      i++;
    } else {
      options[key] = true;
    }
  }
}

generateIdentity({
  name: options.name as string,
  niche: options.niche as string,
  audience: options.audience as string,
  values: options.values as string,
  output: options.output as string,
  interactive: options.interactive === true,
  extractPrompt: options['extract-prompt'] === true
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
