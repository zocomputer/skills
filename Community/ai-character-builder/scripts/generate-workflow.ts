#!/usr/bin/env bun
/**
 * AI Character Builder - Content Workflow Generator
 * Generates content automation workflow templates
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { dirname, join } from "path";

interface CharacterIdentity {
  name: string;
  niche: string;
  audience: string;
  values: string[];
}

interface ContentWorkflow {
  character_name: string;
  platforms: string[];
  frequency: string;
  content_pillars: string[];
  posting_schedule: Record<string, string[]>;
  content_templates: {
    type: string;
    template: string;
    best_for: string[];
    hashtags: string[];
  }[];
  automation_config: {
    tools: string[];
    workflows: {
      name: string;
      trigger: string;
      actions: string[];
    }[];
  };
  generated_at: string;
}

const PLATFORM_CONTENT_TYPES: Record<string, string[]> = {
  tiktok: ['trend-jacking', 'tutorial', 'behind-scenes', 'trend-participation', 'story-time'],
  instagram: ['carousel-educational', 'reel-tutorial', 'story-poll', 'static-quote', 'live-qa'],
  youtube: ['long-form-tutorial', 'shorts-quick-tip', 'community-post', 'premiere', 'livestream'],
  twitter: ['thread-educational', 'single-insight', 'poll', 'retweet-commentary', 'hot-take'],
  linkedin: ['professional-insight', 'career-story', 'industry-news-commentary', 'carousel-case-study'],
  pinterest: ['infographic', 'step-by-step-guide', 'inspirational-quote', 'product-showcase']
};

const CONTENT_PILLAR_TEMPLATES: Record<string, string[]> = {
  'tech': ['Tutorials & How-Tos', 'Industry News Analysis', 'Tool Reviews', 'Behind the Code', 'Myth Busting'],
  'fitness': ['Workout Routines', 'Nutrition Tips', 'Progress Showcases', 'Myth Busting', 'Motivation'],
  'fashion': ['Style Guides', 'Trend Analysis', 'Wardrobe Tips', 'Behind the Design', 'Sustainable Fashion'],
  'food': ['Recipes', 'Technique Tutorials', 'Restaurant Reviews', 'Cultural Stories', 'Meal Prep'],
  'finance': ['Money Tips', 'Investment Basics', 'Market Analysis', 'Debt Free Journey', 'Financial Literacy'],
  'travel': ['Destination Guides', 'Budget Tips', 'Cultural Insights', 'Hidden Gems', 'Travel Hacks'],
  'gaming': ['Gameplay Highlights', 'Reviews', 'Strategy Guides', 'Community Events', 'Industry News'],
  'education': ['Study Tips', 'Concept Explanations', 'Resource Recommendations', 'Success Stories', 'Q&A Sessions']
};

function generateContentPillars(niche: string): string[] {
  const key = Object.keys(CONTENT_PILLAR_TEMPLATES).find(k => niche.toLowerCase().includes(k));
  return key ? CONTENT_PILLAR_TEMPLATES[key] : 
    ['Educational Content', 'Behind the Scenes', 'Community Engagement', 'Trending Topics', 'Value Bombs'];
}

function generatePostingSchedule(platforms: string[], frequency: string): Record<string, string[]> {
  const schedule: Record<string, string[]> = {};
  
  const frequencies: Record<string, number> = {
    'daily': 7,
    'weekly': 3,
    'bi-weekly': 1
  };
  
  const postsPerWeek = frequencies[frequency] || 3;
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  platforms.forEach((platform, pIdx) => {
    const platformPosts = Math.max(1, Math.floor(postsPerWeek / platforms.length) + (pIdx < postsPerWeek % platforms.length ? 1 : 0));
    const platformDays: string[] = [];
    
    for (let i = 0; i < platformPosts; i++) {
      const dayIndex = (pIdx + i * Math.floor(7 / platformPosts)) % 7;
      platformDays.push(days[dayIndex]);
    }
    
    schedule[platform] = platformDays;
  });
  
  return schedule;
}

function generateContentTemplates(niche: string, platforms: string[]): ContentWorkflow['content_templates'] {
  const templates: ContentWorkflow['content_templates'] = [];
  
  // Hook templates
  templates.push({
    type: 'hook-educational',
    template: `3 things about ${niche} I wish I knew sooner:\n\n1. [Insight 1]\n2. [Insight 2]\n3. [Insight 3]\n\nWhich one surprised you? 👇`,
    best_for: platforms.filter(p => ['tiktok', 'instagram', 'twitter'].includes(p)),
    hashtags: ['#LearnOnTikTok', '#Educational', '#Tips']
  });
  
  // Story template
  templates.push({
    type: 'story-personal',
    template: `I used to struggle with [problem].\n\nThen I discovered [solution].\n\nHere's what changed:\n\n[Transformation story with before/after]\n\nIf you're going through this, you're not alone.`,
    best_for: platforms.filter(p => ['instagram', 'tiktok', 'youtube'].includes(p)),
    hashtags: ['#StoryTime', '#Transformation', '#Growth']
  });
  
  // Quick tip template
  templates.push({
    type: 'quick-tip',
    template: `⚡ Quick ${niche} tip:\n\n[Actionable advice in 1-2 sentences]\n\nSave this for later!`,
    best_for: platforms,
    hashtags: ['#QuickTip', '#ProTip', '#LifeHack']
  });
  
  // Myth busting template
  templates.push({
    type: 'myth-buster',
    template: `❌ Myth: [Common misconception]\n\n✅ Truth: [Actual fact]\n\nStop believing everything you hear about ${niche}!`,
    best_for: platforms.filter(p => ['tiktok', 'twitter', 'instagram'].includes(p)),
    hashtags: ['#MythBusted', '#Facts', '#Truth']
  });
  
  // Carousel template
  templates.push({
    type: 'carousel-educational',
    template: `Slide 1: Hook - "The ${niche} mistake costing you [outcome]"\nSlide 2-4: The problem breakdown\nSlide 5-7: The solution steps\nSlide 8: CTA - "Follow for more ${niche} tips"`,
    best_for: platforms.filter(p => ['instagram', 'linkedin'].includes(p)),
    hashtags: ['#Carousel', '#Learn', '#Education']
  });
  
  return templates;
}

function generateAutomationConfig(platforms: string[]): ContentWorkflow['automation_config'] {
  const tools: string[] = [];
  const workflows: ContentWorkflow['automation_config']['workflows'] = [];
  
  // Recommend tools based on platforms
  if (platforms.includes('instagram') || platforms.includes('tiktok') || platforms.includes('twitter')) {
    tools.push('Blotato', 'Buffer', 'Later');
  }
  if (platforms.includes('youtube')) {
    tools.push('TubeBuddy', 'VidIQ', 'YouTube Studio');
  }
  if (platforms.includes('linkedin')) {
    tools.push('Shield', 'Taplio', 'AuthoredUp');
  }
  
  // Standard workflows
  workflows.push({
    name: 'Content Calendar Reminder',
    trigger: 'Scheduled (day before posting)',
    actions: ['Send notification', 'Prepare content assets', 'Schedule review']
  });
  
  workflows.push({
    name: 'Cross-Post Distribution',
    trigger: 'Primary content published',
    actions: ['Adapt format for each platform', 'Schedule cross-posts', 'Track engagement']
  });
  
  workflows.push({
    name: 'Engagement Response',
    trigger: 'New comment received',
    actions: ['Categorize sentiment', 'Draft response suggestions', 'Flag high-priority mentions']
  });
  
  return { tools, workflows };
}

async function generateWorkflow(options: {
  identity?: string;
  platforms?: string;
  frequency?: string;
  output?: string;
}): Promise<void> {
  const { identity, platforms = 'tiktok,instagram', frequency = 'weekly', output } = options;
  
  if (!identity) {
    console.error("❌ Error: Identity file path is required");
    console.log("\nUsage:");
    console.log("  bun generate-workflow.ts --identity ./my-character.json");
    console.log("  bun generate-workflow.ts --identity ./my-character.json --platforms tiktok,instagram,youtube");
    console.log("\nPlatforms: tiktok, instagram, youtube, twitter, linkedin, pinterest");
    console.log("Frequency: daily, weekly, bi-weekly");
    process.exit(1);
  }
  
  if (!existsSync(identity)) {
    console.error(`❌ Error: Identity file not found: ${identity}`);
    process.exit(1);
  }
  
  // Load identity
  const identityData: CharacterIdentity = JSON.parse(await readFile(identity, 'utf-8'));
  console.log(`📅 Generating content workflow for: ${identityData.name}\n`);
  
  // Parse platforms
  const platformList = platforms.split(',').map(p => p.trim().toLowerCase());
  
  // Generate workflow components
  const contentPillars = generateContentPillars(identityData.niche);
  const postingSchedule = generatePostingSchedule(platformList, frequency);
  const contentTemplates = generateContentTemplates(identityData.niche, platformList);
  const automationConfig = generateAutomationConfig(platformList);
  
  const workflow: ContentWorkflow = {
    character_name: identityData.name,
    platforms: platformList,
    frequency,
    content_pillars: contentPillars,
    posting_schedule: postingSchedule,
    content_templates: contentTemplates,
    automation_config: automationConfig,
    generated_at: new Date().toISOString()
  };
  
  // Output path
  const outputPath = output || `./${identityData.name.toLowerCase().replace(/\s+/g, '-')}-workflow.json`;
  const dir = dirname(outputPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  
  await writeFile(outputPath, JSON.stringify(workflow, null, 2));
  
  // Print summary
  console.log("📋 Content Workflow Summary:\n");
  console.log(`  Character: ${identityData.name}`);
  console.log(`  Platforms: ${platformList.join(', ')}`);
  console.log(`  Frequency: ${frequency}`);
  console.log(`\n  Content Pillars:`);
  contentPillars.forEach((pillar, idx) => {
    console.log(`    ${idx + 1}. ${pillar}`);
  });
  console.log(`\n  Posting Schedule:`);
  Object.entries(postingSchedule).forEach(([platform, days]) => {
    console.log(`    ${platform}: ${days.join(', ')}`);
  });
  console.log(`\n  Content Templates: ${contentTemplates.length} types`);
  contentTemplates.forEach(t => console.log(`    - ${t.type} (${t.best_for.join(', ')})`));
  console.log(`\n  Recommended Tools:`);
  automationConfig.tools.forEach(tool => console.log(`    - ${tool}`));
  console.log(`\n  Automation Workflows:`);
  automationConfig.workflows.forEach(wf => {
    console.log(`    - ${wf.name} (${wf.trigger})`);
  });
  console.log(`\n💾 Workflow saved: ${outputPath}`);
  
  console.log("\n💡 Next steps:");
  console.log("  1. Review content pillars and customize for your brand");
  console.log("  2. Set up your chosen scheduling tool");
  console.log("  3. Create a content bank using the templates");
  console.log("  4. Deploy the tutorial page: bun deploy-tutorial.ts");
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

generateWorkflow({
  identity: options.identity,
  platforms: options.platforms,
  frequency: options.frequency,
  output: options.output
}).catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
