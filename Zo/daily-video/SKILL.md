---
name: Set up daily video studio with Remotion
description: Sets up a system that automatically creates educational videos every day on a schedule
metadata:
  author: Zo
  emoji: 🎥
---

# Set Up Daily Video Studio with Remotion

# How to Use This File

This file will be included in a user request. If it is, and the user has provided the necessary inputs, Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function.

## Purpose

This document codifies the procedure for setting up a Remotion video studio on Zo Computer that automatically generates educational videos on a daily schedule. The default example creates daily Japanese vocabulary videos with animated React components, but can be customized for any educational content.

## Inputs

- **Video topic:** What the daily videos should teach (default: "3 Japanese words")
- **Schedule time:** When to generate videos each day (default: 9:00 AM user's timezone)
- **Project name:** Name for the Remotion project (default: "daily-video-studio")

## Procedure

### 1. Create the Remotion project

```bash
# Create project directory
mkdir -p <project_name>
cd <project_name>

# Initialize package.json
cat > package.json << 'EOF'
{
  "name": "<project_name>",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "remotion studio",
    "build": "remotion render DailyLesson out/video.mp4",
    "generate": "node generate-daily.js"
  },
  "dependencies": {
    "@remotion/cli": "^4.0.0",
    "remotion": "^4.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "motion": "^11.0.0",
    "@ibelick/motion-primitives": "^0.1.0"
  }
}
EOF

# Install dependencies
npm install
```

### 2. Create the Remotion composition

```bash
# Create src directory
mkdir -p src

# Create Root.jsx - main composition registry
cat > src/Root.jsx << 'EOF'
import React from 'react';
import { Composition } from 'remotion';
import { DailyLesson } from './DailyLesson';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="DailyLesson"
        component={DailyLesson}
        durationInFrames={300}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          words: [
            { kanji: '食べる', hiragana: 'たべる', romaji: 'taberu', meaning: 'to eat' },
            { kanji: '飲む', hiragana: 'のむ', romaji: 'nomu', meaning: 'to drink' },
            { kanji: '見る', hiragana: 'みる', romaji: 'miru', meaning: 'to see' },
          ],
        }}
      />
    </>
  );
};
EOF

# Create DailyLesson.jsx - the actual video composition
cat > src/DailyLesson.jsx << 'EOF'
import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring } from 'remotion';

export const DailyLesson = ({ words }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ backgroundColor: '#0A0A0A' }}>
      {/* Title sequence */}
      <Sequence from={0} durationInFrames={60}>
        <Title frame={frame} />
      </Sequence>

      {/* Word sequences - 80 frames each */}
      {words.map((word, i) => (
        <Sequence key={i} from={60 + i * 80} durationInFrames={80}>
          <WordCard word={word} frame={frame - (60 + i * 80)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

const Title = ({ frame }) => {
  const opacity = interpolate(frame, [0, 30], [0, 1]);
  const scale = spring({
    frame,
    fps: 30,
    config: { damping: 100 }
  });

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      opacity,
    }}>
      <h1 style={{
        fontSize: 80,
        color: 'white',
        fontWeight: 'bold',
        transform: `scale(${scale})`,
      }}>
        Today's Words
      </h1>
    </AbsoluteFill>
  );
};

const WordCard = ({ word, frame }) => {
  const opacity = interpolate(frame, [0, 20], [0, 1]);
  const y = interpolate(frame, [0, 20], [50, 0]);

  return (
    <AbsoluteFill style={{
      justifyContent: 'center',
      alignItems: 'center',
      opacity,
      transform: `translateY(${y}px)`,
    }}>
      <div style={{
        padding: 60,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 24,
        textAlign: 'center',
        maxWidth: 800,
      }}>
        <div style={{ fontSize: 120, color: 'white', marginBottom: 20 }}>
          {word.kanji}
        </div>
        <div style={{ fontSize: 60, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>
          {word.hiragana}
        </div>
        <div style={{ fontSize: 50, color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
          {word.romaji}
        </div>
        <div style={{ fontSize: 45, color: 'white', fontStyle: 'italic' }}>
          "{word.meaning}"
        </div>
      </div>
    </AbsoluteFill>
  );
};
EOF
```

### 3. Create the daily generation script

```bash
# Create generate-daily.js - fetches new words and renders video
cat > generate-daily.js << 'EOF'
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { writeFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import path from 'path';

// In a real implementation, fetch from API or database
async function fetchDailyWords() {
  // Example: could call Japanese dictionary API
  // For now, return sample words (customize this!)
  const allWords = [
    { kanji: '歩く', hiragana: 'あるく', romaji: 'aruku', meaning: 'to walk' },
    { kanji: '走る', hiragana: 'はしる', romaji: 'hashiru', meaning: 'to run' },
    { kanji: '書く', hiragana: 'かく', romaji: 'kaku', meaning: 'to write' },
  ];

  // Select 3 random words
  return allWords.sort(() => Math.random() - 0.5).slice(0, 3);
}

async function generateVideo() {
  console.log('🎬 Starting daily video generation...');

  const words = await fetchDailyWords();
  console.log('📝 Today\'s words:', words);

  // Create output directory
  const outputDir = './out';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Bundle Remotion project
  console.log('📦 Bundling project...');
  const bundleLocation = await bundle({
    entryPoint: path.resolve('./src/Root.jsx'),
    webpackOverride: (config) => config,
  });

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: 'DailyLesson',
    inputProps: { words },
  });

  // Render video
  const date = new Date().toISOString().split('T')[0];
  const outputPath = path.join(outputDir, `lesson-${date}.mp4`);

  console.log('🎥 Rendering video...');
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { words },
  });

  console.log(`✅ Video saved to ${outputPath}`);

  // Save metadata
  await writeFile(
    path.join(outputDir, `lesson-${date}.json`),
    JSON.stringify({ date, words }, null, 2)
  );
}

generateVideo().catch(console.error);
EOF
```

### 4. Create configuration files

```bash
# Create remotion.config.ts
cat > remotion.config.ts << 'EOF'
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setImageFormat('jpeg');
Config.setQuality(90);

export default Config;
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
out/
dist/
.remotion/
*.mp4
*.mov
EOF
```

### 5. Test the setup

```bash
# Generate a test video
npm run generate

# Verify output exists
ls -lh out/
```

### 6. Schedule daily generation

Use the `create_scheduled_task` tool to schedule daily video generation:

```markdown
create_scheduled_task(
rrule="FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
instruction="Navigate to the <project_name> directory and run: npm run generate. After the video is generated, inform me that today's lesson video is ready at out/lesson-YYYY-MM-DD.mp4"
)
```

Replace `<project_name>` with the actual project directory path.

The schedule format `FREQ=DAILY;BYHOUR=9;BYMINUTE=0` means:

- Generate video every day
- At 9:00 AM in the user's timezone
- Customize BYHOUR and BYMINUTE as needed (24-hour format)

## Expected Output

- Remotion project created at `<project_name>/`
- Dependencies installed (remotion, motion-primitives, react)
- Sample composition with animated vocabulary cards
- Daily generation script that renders videos
- Scheduled task that runs daily at specified time
- Videos saved to `<project_name>/out/lesson-YYYY-MM-DD.mp4`

## Notification to the User

After successful setup, inform the user:

**Daily Video Studio is configured!**

Your Remotion project is ready at `<project_name>/`

📹 **Generated videos will be saved to:** `<project_name>/out/`

🕐 **Schedule:** Videos generate daily at `<schedule_time>`

### What you can do now:

**Preview and edit:**

```bash
cd <project_name>
npm run dev
```

This opens Remotion Studio in your browser where you can see the composition and make changes.

**Generate a video manually:**

```bash
cd <project_name>
npm run generate
```

**Customize the content:**

- Edit `src/DailyLesson.jsx` to change the video design
- Modify `generate-daily.js` to e.g. fetch words from an API
- Store usage data to a file and dynamically present new content
- Adjust animation timing, colors, and transitions
- Add motion-primitives components for more effects

**View scheduled tasks:**

```bash
# Ask Zo: "show my scheduled tasks"
```

### Customization Ideas

The default setup teaches Japanese vocabulary, but you can customize for any topic:

**Language learning:**

- Spanish verbs with conjugations
- French phrases with pronunciation
- Chinese characters with stroke order

**Educational content:**

- Math problems with step-by-step solutions
- Science facts with visualizations
- Historical events with timelines
- Programming concepts with code examples

**Personal development:**

- Daily affirmations
- Quote of the day
- Workout routines
- Meditation guides

Just modify the `fetchDailyWords()` function in `generate-daily.js` and the `WordCard` component in `src/DailyLesson.jsx` to match your content structure.

## Service Management

- View scheduled tasks: Ask Zo "show my scheduled tasks"
- Edit the schedule: Use `edit_scheduled_task` tool
- Delete the schedule: Use `delete_scheduled_task` tool
- Videos accumulate in the `out/` directory (manage storage as needed)

