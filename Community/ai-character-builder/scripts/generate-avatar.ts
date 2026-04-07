#!/usr/bin/env bun
/**
 * AI Character Builder - Avatar Generator
 * Generates avatar images using fal.ai based on character identity
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { basename, dirname, join } from "path";

interface CharacterIdentity {
  name: string;
  niche: string;
  visual: {
    style: string;
    age_range: string;
    aesthetic: string;
  };
  prompts: {
    midjourney: string;
    stable_diffusion: string;
  };
}

const STYLE_ENHANCEMENTS: Record<string, string> = {
  photorealistic: "photorealistic, highly detailed, professional photography, 8k uhd",
  cyberpunk: "neon accents, cyberpunk aesthetic, glowing elements, futuristic, digital art",
  claymation: "clay material, 3D render, soft rounded shapes, pixar style, stop-motion aesthetic",
  anime: "anime style, manga aesthetic, cel shaded, vibrant colors, studio ghibli inspired",
  watercolor: "watercolor painting, artistic, soft edges, hand-painted aesthetic, illustration",
  minimal: "minimalist, clean lines, flat design, vector art, modern illustration"
};

const POSE_VARIATIONS: Record<string, string> = {
  happy: "smiling, warm expression, approachable, friendly pose",
  serious: "serious expression, professional pose, confident, focused gaze",
  thinking: "thoughtful expression, hand near chin, contemplative, intellectual",
  excited: "energetic pose, enthusiastic expression, dynamic, engaging",
  neutral: "neutral expression, professional headshot, versatile, adaptable"
};

async function generateAvatar(options: {
  identity?: string;
  style?: string;
  count?: number;
  outputDir?: string;
  poses?: string;
}): Promise<void> {
  const { identity, style = 'photorealistic', count = 1, outputDir = './avatars', poses = 'neutral' } = options;
  
  if (!identity) {
    console.error("❌ Error: Identity file path is required");
    console.log("\nUsage:");
    console.log("  bun generate-avatar.ts --identity ./my-character.json");
    console.log("  bun generate-avatar.ts --identity ./my-character.json --style cyberpunk --count 4");
    console.log("\nStyles: photorealistic, cyberpunk, claymation, anime, watercolor, minimal");
    console.log("Poses: happy, serious, thinking, excited, neutral");
    process.exit(1);
  }
  
  if (!existsSync(identity)) {
    console.error(`❌ Error: Identity file not found: ${identity}`);
    process.exit(1);
  }
  
  // Load identity
  const identityData: CharacterIdentity = JSON.parse(await readFile(identity, 'utf-8'));
  console.log(`🎨 Generating avatars for: ${identityData.name}\n`);
  
  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }
  
  // Parse poses
  const poseList = poses.split(',').map(p => p.trim());
  const styleEnhancement = STYLE_ENHANCEMENTS[style] || STYLE_ENHANCEMENTS.photorealistic;
  
  // Generate prompts for each pose
  const prompts: { pose: string; prompt: string; filename: string }[] = [];
  
  for (let i = 0; i < Math.min(count, poseList.length); i++) {
    const pose = poseList[i] || 'neutral';
    const poseVariation = POSE_VARIATIONS[pose] || POSE_VARIATIONS.neutral;
    
    // Build enhanced prompt
    const basePrompt = identityData.prompts.stable_diffusion;
    const enhancedPrompt = `${basePrompt}, ${styleEnhancement}, ${poseVariation}`;
    
    const filename = `${identityData.name.toLowerCase().replace(/\s+/g, '-')}-${style}-${pose}-v1.png`;
    
    prompts.push({ pose, prompt: enhancedPrompt, filename });
  }
  
  // Display what will be generated
  console.log("📋 Generation Plan:\n");
  prompts.forEach(({ pose, filename }, idx) => {
    console.log(`  ${idx + 1}. ${pose} pose → ${filename}`);
  });
  
  console.log("\n🚀 Generating images via fal.ai...\n");
  
  // Generate each image using fal-ai-media skill
  const falScriptPath = '/home/workspace/Skills/fal-ai-media/scripts/fal-media.ts';
  
  if (!existsSync(falScriptPath)) {
    console.error("❌ Error: fal-ai-media skill not found. Install it first:");
    console.log("  cd /home/workspace/Skills && git clone <fal-ai-media-repo> fal-ai-media");
    process.exit(1);
  }
  
  const generatedFiles: string[] = [];
  
  for (const { pose, prompt, filename } of prompts) {
    const outputPath = join(outputDir, filename);
    
    console.log(`  Generating ${pose} pose...`);
    
    try {
      const proc = Bun.spawn([
        'bun', falScriptPath,
        'generate',
        '--prompt', prompt,
        '--model', 'nano-banana-2',
        '--output', outputPath
      ], {
        stdout: 'pipe',
        stderr: 'pipe'
      });
      
      const exitCode = await proc.exited;
      
      if (exitCode === 0) {
        console.log(`    ✅ Saved: ${outputPath}`);
        generatedFiles.push(outputPath);
      } else {
        const stderr = await new Response(proc.stderr).text();
        console.error(`    ❌ Failed: ${stderr.slice(0, 200)}`);
      }
    } catch (err) {
      console.error(`    ❌ Error: ${err}`);
    }
  }
  
  // Summary
  console.log("\n📊 Generation Summary:\n");
  console.log(`  Total requested: ${prompts.length}`);
  console.log(`  Successfully generated: ${generatedFiles.length}`);
  console.log(`  Output directory: ${outputDir}`);
  
  if (generatedFiles.length > 0) {
    console.log("\n  Generated files:");
    generatedFiles.forEach(f => console.log(`    - ${f}`));
  }
  
  // Save metadata
  const metadataPath = join(outputDir, 'generation-metadata.json');
  const metadata = {
    character_name: identityData.name,
    style,
    poses: poseList,
    generated_at: new Date().toISOString(),
    files: generatedFiles.map(f => basename(f))
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  console.log(`\n💾 Metadata saved: ${metadataPath}`);
  
  console.log("\n💡 Next steps:");
  console.log("  1. Review generated images");
  console.log("  2. Use generate-voice.ts to create voice config");
  console.log("  3. Use generate-workflow.ts to set up content automation");
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: Record<string, string | number> = {};

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

generateAvatar({
  identity: options.identity as string,
  style: options.style as string,
  count: options.count ? parseInt(options.count as string) : 1,
  outputDir: options['output-dir'] as string,
  poses: options.poses as string
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
