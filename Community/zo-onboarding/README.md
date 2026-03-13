# 🎉 Zo Onboarding Specialist

> A warm, guided, personalized onboarding experience for brand-new Zo Computer users.

---

## Overview

**zo-onboarding** is a Skill + Persona package that transforms the Zo Computer first-run experience into a guided, human-centred conversation. Instead of a generic getting-started checklist, new users receive a fully personalized onboarding journey tailored to their life, goals, and comfort with technology.

The experience is built around three pillars:

1. **Discover** — A one-question-at-a-time conversation that learns who the user is, what they need, and how they want to use Zo.
2. **Match** — Feature recommendations in plain language, connected directly to what the user told you, shown one at a time at the user's own pace.
3. **Plan & Follow Up** — A named, saved onboarding plan and an optional scheduled check-in agent that automatically keeps the user on track via Telegram, SMS, or email.

This package consists of two components that work together and auto-install each other if only one is present:

| Component | What it is | How to install |
|-----------|-----------|----------------|
| **`zo-onboarding` Skill** | The workflow, feature reference, and agent-creation instructions | Copy to `Skills/zo-onboarding/` |
| **Zo Onboarding Guide Persona** | The warm, patient personality layer | Install via Settings > AI > Personas |

---

## Features

- **One-at-a-time discovery conversation** — Never overwhelms the user with lists or forms. Each question flows naturally from the previous answer.
- **Personalized feature matching** — Matches Zo capabilities (Agents, Integrations, Personas, Zo Space, and more) to the user's actual goals, not a fixed demo script.
- **Plain-language feature walkthroughs** — Every explanation: name it, explain it simply, connect it to the user's life, show how to use it, check in before moving on.
- **Custom onboarding plan** — A named checklist saved to `Documents/zo-onboarding-plan.md` with time estimates and step-by-step ordering chosen for that specific user.
- **Scheduled check-in agent** — At session close, offers to create a Zo Agent that automatically messages the user in a day or two to celebrate progress and remind them of their next step. Also serves as a hands-on introduction to the Agents feature.
- **Cross-dependency auto-install** — If only the persona is installed, it generates the skill file. If only the skill is installed, it creates the persona. Either entry point leads to a fully functioning workflow.
- **Progress tracking** — Checks off completed plan steps across sessions and opens returning-user sessions with specific, genuine acknowledgment of what was accomplished.

---

## Installation

### Option A: Install Both Together (Recommended)

1. Copy this entire `zo-onboarding/` folder to `/home/workspace/Skills/zo-onboarding/`
2. In Zo, go to [Settings > AI > Personas](/?t=settings&s=ai&d=personas) and create a new persona named **Zo Onboarding Guide** using the prompt from `persona-export.md`
3. Switch to the Zo Onboarding Guide persona when starting an onboarding session

### Option B: Install Skill Only

Copy `SKILL.md` and `README.md` to `/home/workspace/Skills/zo-onboarding/`. When you run the skill, it will automatically detect the missing persona and create it for you.

### Option C: Install Persona Only

Create the persona in [Settings > AI > Personas](/?t=settings&s=ai&d=personas) using the prompt in `persona-export.md`. When you activate it and start a conversation, it will automatically detect the missing skill file and generate it.

---

## Usage

### Starting an Onboarding Session

1. **Switch to the persona** — Go to [Settings > AI > Personas](/?t=settings&s=ai&d=personas) and activate **Zo Onboarding Guide**
2. **Start a new conversation** — The guide will open with a warm welcome and begin the discovery sequence
3. **Let the user lead** — Answer questions at their pace. The guide adapts entirely to their answers.

### Running Inline (Without Persona)

If you want to run the onboarding flow within an existing conversation:

```
Run the zo-onboarding skill
```

Zo will read the SKILL.md and follow the workflow within the current session, without switching personas.

### Sharing with a New User

Point a new Zo user to [Settings > AI > Personas](/?t=settings&s=ai&d=personas), have them activate **Zo Onboarding Guide**, and tell them to say "Hi" to get started. That's it.

---

## What Gets Created

During an onboarding session, the following files and resources are created in the user's workspace:

| Resource | Path | Description |
|----------|------|-------------|
| Onboarding plan | `Documents/zo-onboarding-plan.md` | Named, personalized checklist with time estimates |
| Check-in agent | Visible at [Agents](/?t=agents) | Scheduled Telegram/SMS/email reminder (optional, created at session end) |

---

## Zo Feature Coverage

The skill can introduce and explain any of the following Zo features, matching them to the user's specific situation:

| Feature | Best For |
|---------|----------|
| Chat workspace | Everyone. The home base for all Zo interactions. |
| [Agents](/?t=agents) | Automations, reminders, recurring summaries, scheduled tasks |
| [Hosting](/?t=sites) | Publishing websites, APIs, dashboards, link-in-bio pages |
| [Datasets](/?t=datasets) | Importing and analyzing structured data |
| [Integrations](/?t=settings&s=integrations) | Gmail, Calendar, Drive, Notion, Spotify, Dropbox, and more |
| [Personas](/?t=settings&s=ai&d=personas) | Customizing Zo's personality and role for different tasks |
| [Rules](/?t=settings&s=ai&d=rules) | Teaching Zo your preferences and working style |
| [Personalization](/?t=settings&s=ai&d=personalization) | Name, bio, timezone, language |
| [Browser](/browser) | Logging into websites so Zo can access them |
| [Terminal](/?t=terminal) | Command-line access (introduced gently for comfortable users) |
| Zo Space | Personal website and API hosting at `<handle>.zo.space` |
| Skills | Packaged workflows and automations |
| [Channels](/?t=settings&s=channels) | Telegram, SMS, and email access to Zo |
| [Sell](/?t=sell) | Selling products and accepting payments via Stripe |

---

## Tone & Communication Philosophy

The Zo Onboarding Guide persona follows a strict communication framework:

- **One question at a time** — never a list of questions, never two things at once
- **Plain language always** — no jargon unless immediately defined in everyday terms
- **Specific encouragement** — not "great job" but "you just set up your first Zo workflow, that's something most people skip and then wish they hadn't"
- **Zero pressure** — users can skip steps, go off-topic, or move slowly without ever feeling behind
- **Always end with a next step** — no session ends without the user knowing exactly what to do next

---

## Scheduled Check-In Agent

One of the standout features of this skill is the automatic check-in agent offered at the end of the first session.

### How it works

After the onboarding plan is created and at least one step is completed, the guide naturally offers:

> "One really cool thing Zo can do is check in with you automatically, like a friendly reminder. I can set up a little check-in that sends you a message in a couple of days to see how you're doing and remind you of your next step. Want me to set that up?"

If the user agrees, Zo creates a scheduled agent using `create_agent` with:
- A fully self-contained instruction (reads the user's plan file at runtime to check current progress)
- RRULE scheduling (2-day default, customizable)
- Telegram as the preferred delivery method (per Zo best practices)
- A COUNT limit (3–5 check-ins) so it doesn't run indefinitely

### Why this matters

This check-in agent also serves as the user's first hands-on introduction to Zo's Agents feature — they learn about it by creating one for themselves.

---

## Edge Cases

| Situation | How the guide handles it |
|-----------|--------------------------|
| Very technical user | Adapts language, moves faster through basics, still follows the personalized plan structure |
| User goes off-topic | Warm redirect: "That's a great question — let's note it and come back once your core setup makes more sense" |
| User wants to skip steps | Respects the choice, notes what was skipped, makes returning easy |
| User is unsure what they want | Shifts into needs-discovery mode: asks about frustrations, daily pain points, and what a "perfect day" would look like |
| Unsure which feature fits | Asks one more clarifying question rather than guessing |
| User expresses frustration | Slows down, validates the feeling, offers a simpler path — never rushes |

---

## File Structure

```
Skills/zo-onboarding/
├── SKILL.md              # Workflow instructions, feature reference, agent creation spec
├── README.md             # This file
└── persona-export.md     # Exportable persona prompt for the Zo Onboarding Guide
```

---

## Requirements

- Zo Computer (any plan)
- No API keys or secrets required
- Telegram connected recommended (for check-in agents) — set up at [Settings > Channels](/?t=settings&s=channels)

---

## Contributing

Found a feature Zo added that should be in the onboarding reference table? Have a better discovery question? Open a PR against the `Community/zo-onboarding/` folder in [zocomputer/skills](https://github.com/zocomputer/skills).

---

## License

MIT — free to use, modify, and share.
