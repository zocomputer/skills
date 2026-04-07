---
name: ai-character-builder
description: >
  CLI toolkit for creating AI characters: generate identity profiles, avatar images,
  voice configs, and content workflows. Includes a deployable zo.space tutorial page
  for interactive learning. Hybrid approach: automate with CLI, learn with the web UI.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
---

# AI Character Builder

A hybrid toolkit for creating AI characters:
- **CLI Tools**: Generate assets, prompts, and configs via command line
- **Web Tutorial**: Deploy an interactive 5-phase tutorial to your zo.space

## Quick Start

### 1. Generate a Character Identity
```bash
cd /home/workspace/Skills/ai-character-builder/scripts
bun generate-identity.ts --name "Aria Nova" --niche "Sustainable Tech" --output ./my-character.json
```

### 2. Generate Avatar Images
```bash
bun generate-avatar.ts --identity ./my-character.json --style photorealistic --count 4
```

### 3. Generate Voice Config
```bash
bun generate-voice.ts --identity ./my-character.json --provider elevenlabs
```

### 4. Generate Content Workflow
```bash
bun generate-workflow.ts --identity ./my-character.json --platforms tiktok,instagram
```

### 5. Deploy the Tutorial Page to Your zo.space
```bash
bun deploy-tutorial.ts --path /character-builder
```

## CLI Commands

### generate-identity.ts
Creates a character identity profile with AI-generated backstory, values, and audience targeting.

**Options:**
- `--name` - Character name (required)
- `--niche` - Specific niche/topic (required)
- `--audience` - Target audience description
- `--values` - Comma-separated core values
- `--output` - Output JSON file path
- `--interactive` - Interactive mode (prompts for inputs)

**Example:**
```bash
bun generate-identity.ts --interactive
```

### generate-avatar.ts
Generates avatar images using fal.ai based on the identity profile.

**Options:**
- `--identity` - Path to identity JSON (required)
- `--style` - Style: photorealistic, cyberpunk, claymation, anime
- `--count` - Number of variations (1-10)
- `--output-dir` - Directory for saved images
- `--poses` - Comma-separated poses: happy, serious, thinking, excited

**Example:**
```bash
bun generate-avatar.ts --identity ./my-character.json --style cyberpunk --count 4 --poses happy,serious
```

### generate-voice.ts
Generates voice configuration recommendations for TTS providers.

**Options:**
- `--identity` - Path to identity JSON (required)
- `--provider` - TTS provider: elevenlabs, azure, amazon-polly, google
- `--output` - Output config file path

**Example:**
```bash
bun generate-voice.ts --identity ./my-character.json --provider elevenlabs --output ./voice-config.json
```

### generate-workflow.ts
Creates content automation workflow templates.

**Options:**
- `--identity` - Path to identity JSON (required)
- `--platforms` - Comma-separated platforms: tiktok, instagram, youtube, twitter
- `--frequency` - Posting frequency: daily, weekly, bi-weekly
- `--output` - Output workflow file path

**Example:**
```bash
bun generate-workflow.ts --identity ./my-character.json --platforms tiktok,instagram --frequency daily
```

### deploy-tutorial.ts
Deploys the interactive tutorial page to your zo.space.

**Options:**
- `--path` - Route path (default: /character-builder)
- `--public` - Make page publicly accessible

**Example:**
```bash
bun deploy-tutorial.ts --path /ai-character-guide --public
```

## Tutorial Page Features

The zo.space page includes:
- **5 Interactive Phases**: Identity → Avatar → Animation → Voice → Content
- **Progress Tracking**: localStorage persists completion state
- **Prompt Library**: Copy-paste ready Midjourney/Stable Diffusion prompts
- **Tool Recommendations**: Curated AI tools for each phase
- **Checklist System**: Mark phases complete as you progress

## Prompt Templates

Access built-in prompt templates:
```bash
cat /home/workspace/Skills/ai-character-builder/assets/prompt-templates/midjourney-portraits.md
cat /home/workspace/Skills/ai-character-builder/assets/prompt-templates/stable-diffusion-loras.md
cat /home/workspace/Skills/ai-character-builder/assets/prompt-templates/voice-samples.md
```

## Workflow Integration

Combine with other skills:

### With fal-ai-media (image generation)
```bash
# Generate character images
bun /home/workspace/Skills/fal-ai-media/scripts/fal-media.ts generate \
  --prompt "$(bun generate-identity.ts --name 'Test' --niche 'Tech' --extract-prompt)" \
  --output /home/workspace/Images/character.png
```

### With ffb-social-autoposter (content automation)
```bash
# Generate workflow then use with autoposter
bun generate-workflow.ts --identity ./my-character.json --platforms tiktok
# Use generated config with your social autoposter
```

## File Structure

```
Skills/ai-character-builder/
├── SKILL.md                          # This file
├── scripts/
│   ├── generate-identity.ts          # CLI: Create character identity
│   ├── generate-avatar.ts            # CLI: Generate avatar images
│   ├── generate-voice.ts             # CLI: Generate voice config
│   ├── generate-workflow.ts          # CLI: Generate content workflow
│   ├── deploy-tutorial.ts            # CLI: Deploy zo.space page
│   ├── package.json                  # Dependencies
│   └── tsconfig.json                 # TypeScript config
├── assets/
│   ├── prompt-templates/             # Midjourney/SD prompt templates
│   │   ├── midjourney-portraits.md
│   │   ├── stable-diffusion-loras.md
│   │   └── voice-samples.md
│   └── zo-space-template/            # Source for tutorial page
│       ├── page.tsx                  # Main page component
│       ├── components/               # Reusable components
│       └── hooks/                    # Custom React hooks
└── references/
    └── tools-directory.md            # Curated AI tools list
```

## Setup Requirements

1. **For CLI tools:**
   - Bun runtime (already available on Zo)
   - FAL_KEY in [Settings > Advanced](/?t=settings&s=advanced) for image generation

2. **For zo.space page:**
   - No setup needed - deploys directly to your zo.space

## Tips

- Start with `generate-identity.ts --interactive` for guided creation
- Use `--extract-prompt` flag to get image prompts without saving files
- The tutorial page works standalone - deploy it first to understand the workflow
- All generated files are JSON - easy to edit manually or feed into other tools
