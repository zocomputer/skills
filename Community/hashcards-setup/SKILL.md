---
name: Set up hashcards spaced repetition system
description: Sets up a spaced repetition flashcard system that you can access through your web browser to study and memorize information
metadata:
  author: rc2.zo.computer
  category: Community
  emoji: 📇
---

## How to Use This File

This file will be included in a user request. If it is, Zo should interpret this as the current task at hand and use its tools to carry out the task until completion. Zo should not ask for user confirmation to continue if it has all required parameters to execute this function. Zo should effectively treat the inclusion of this file as a user request to "run" this task.

## Purpose

This document codifies the procedure for setting up hashcards on Zo Computer, enabling a web-based spaced repetition system for learning through flashcards. The setup includes installing Rust/Cargo, building hashcards from source, creating a flashcards directory, and registering the service to run persistently with automatic restarts.

---

# Hashcards Setup Guide on Zo

This guide will walk you through setting up hashcards on your Zo Computer instance, giving you a personal spaced repetition system accessible through your browser.

## What You'll Have When Done

- A hashcards instance running at `https://srs-<your-username>.zocomputer.io`
- Web interface for reviewing flashcards with spaced repetition scheduling
- Plain text card storage in `/home/workspace/flashcards/`
- Support for Q&A cards and cloze deletions
- FSRS (Free Spaced Repetition Scheduler) algorithm for optimal learning
- Markdown and LaTeX (KaTeX) support in cards
- A persistent service that auto-restarts if it crashes

---

## Related Skills

Use `add-flashcards` after completing this setup.

## Prerequisites

This setup will automatically install:

- **Git**: For cloning the hashcards repository
- **Rust/Cargo**: For building hashcards from source (one-time compilation)

No manual prerequisites needed - the command handles all installations.

---

## Setup Instructions

### Step 1: Install Git

Ensure git is available for cloning the repository:

```bash
command -v git || apt-get update && apt-get install -y git
```

**Verify**: Check that git is installed:

```bash
git --version
```

**Expected Result**: You should see a git version number (e.g., `git version 2.x.x`).

---

### Step 2: Install Rust and Cargo

Install Rust toolchain if not already present:

```bash
if ! command -v cargo &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi
```

**Verify**: Check that cargo is installed:

```bash
cargo --version
```

**Expected Result**: You should see a cargo version number (e.g., `cargo 1.x.x`).

**Note**: This is a one-time installation. Rust and Cargo will remain available for future use.

---

### Step 3: Install SQLite Development Libraries

Before building hashcards, install the required SQLite development libraries:

```bash
apt-get update && apt-get install -y libsqlite3-dev
```

**Note**: Hashcards requires SQLite dev libraries to compile. Installing these first prevents build errors.

---

### Step 4: Clone and Build Hashcards

Clone the hashcards repository and build the binary:

```bash
# Clone to temporary directory
cd /tmp
rm -rf hashcards
git clone https://github.com/eudoxia0/hashcards.git
cd hashcards

# Build release binary (this takes 5-10 minutes)
source ~/.cargo/env
cargo build --release

# Install binary to cargo bin directory
mkdir -p ~/.cargo/bin
cp target/release/hashcards ~/.cargo/bin/
```

**Verify**: Check that hashcards is installed:

```bash
~/.cargo/bin/hashcards --version
```

**Expected Result**: You should see version information for hashcards (e.g., `hashcards 0.1.0`).

**Note**: Building from source takes 5-10 minutes on first run, but the compiled binary is cached for instant startup afterwards.

---

### Step 5: Create Flashcards Directory

Set up the directory for storing your flashcard files:

```bash
mkdir -p /home/workspace/flashcards
```

**Verify**: Check the directory exists:

```bash
ls -la /home/workspace/flashcards
```

---

### Step 6: Create Sample Flashcard File

Create an example flashcard file to get started:

```bash
cat > /home/workspace/flashcards/sample.md << 'EOF'
# Sample Flashcards
<!-- Source: Getting started with hashcards -->

Q: What is spaced repetition?
A: A learning technique that involves reviewing information at increasing intervals to improve long-term retention.

Q: What does FSRS stand for?
A: Free Spaced Repetition Scheduler - an algorithm that optimizes review intervals.

C: The capital of France is [Paris].

C: [Hashcards] stores flashcards as plain text files.
EOF
```

**Note**: Cards with `C:` prefix and `[text]` are cloze deletions - the text in brackets will be hidden during review.

**Verify**: Check the sample file was created:

```bash
cat /home/workspace/flashcards/sample.md
```

---

### Step 7: Register the Service

Register hashcards as a persistent user service:

**Using Zo tools:**

```
Use register_user_service with:
- label: srs
- protocol: http
- local_port: 8000
- entrypoint: /root/.cargo/bin/hashcards drill --port 8000 --open-browser false
- workdir: /home/workspace/flashcards
- env_vars: {"PATH": "/root/.cargo/bin:/usr/local/bin:/usr/bin:/bin"}
```

**Critical notes:**

- Use the **full path** `/root/.cargo/bin/hashcards` (not `~/.cargo/bin/`) - shell expansion doesn't work in service entrypoint
- Use `--port 8000` flag (not `--addr 0.0.0.0:8000`)
- Add `--open-browser false` to prevent it trying to open a browser
- Include PATH in env_vars so the binary can be found by the service manager

**Verify**: Use `tool list_user_services` to confirm the `srs` service is registered with an HTTPS URL.

---

### Step 8: Test the Service

Wait a few seconds for the service to start, then test it:

```bash
curl -I https://srs-<your-username>.zocomputer.io
```

Replace `<your-username>` with your Zo username.

**Expected Result**: You should get an HTTP 200 response.

**Check Logs**: If something goes wrong, check the logs:

```bash
cat /dev/shm/srs.log
cat /dev/shm/srs_err.log
```

---

## Accessing Hashcards

Once the service is running, simply open your browser and navigate to:

```markdown
https://srs-<your-username>.zocomputer.io
```

You should see the hashcards web interface with your flashcards ready to review.

---

## What's Running

After completing this setup, you have:

- **Hashcards**: Spaced repetition system running on port 8000
- **Public URL**: `https://srs-<your-username>.zocomputer.io`
- **Database**: SQLite database at `/home/workspace/flashcards/hashcards.db`
- **Cards Directory**: `/home/workspace/flashcards/` - create `file .md` files here
- **Auto-restart**: Zo's service manager will restart the server if it crashes
- **Persistent**: Service survives across system reboots
- **Authentication**: None by default (see Security Notes below)

**Protocol Details**:

- HTTP server running on port 8000 internally
- Exposed via HTTPS on port 443 (standard web port)
- Web interface for reviewing cards
- Compatible with all modern web browsers

---

## Security Notes

**IMPORTANT**: By default, this setup has **no authentication**. Anyone with your URL can access your flashcards.

**Why this might be okay:**

- Flashcards are typically personal study materials, not sensitive data
- The URL is not easily guessable (`srs-<username>.zocomputer.io`)
- You're likely the only person who knows the URL exists

**If you want to add password protection:**

Hashcards itself doesn't have built-in authentication. To add protection, you can:

1. **Use a reverse proxy with basic auth** - Ask Zo to help set up nginx or similar with password protection
2. **Use Cloudflare Access** - Add a zero-trust access layer via Cloudflare
3. **Limit to VPN** - Only access when connected to a VPN

If your flashcards contain sensitive information (e.g., work credentials, personal data), consider adding one of these authentication layers.

---

## Creating Flashcards

Create `file .md` (markdown) files in `/home/workspace/flashcards/`. You can ask Zo to help create cards from any source material.

### Basic Q&A Format

```markdown
Q: What is the question?
A: This is the answer.
```

### Cloze Deletions

Use `C:` prefix and wrap text in `[brackets]`:

```markdown
C: The capital of [France] is [Paris].
```

When reviewing, the text in brackets will be hidden one at a time.

### Markdown and LaTeX

Full markdown formatting and KaTeX math expressions are supported:

```markdown
Q: What is the quadratic formula?
A: $x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$
```

**Tip:** Ask Zo to convert reading notes, articles, or documentation into flashcards. For example: "Convert these notes into hashcards format" or "Create flashcards from this article about X."

---

## Using Hashcards

Open `https://srs-<your-username>.zocomputer.io` and review cards. Grade each with Forgot/Hard/Good/Easy - the FSRS algorithm uses your grades to optimize review intervals.

**Note**: Hashcards identifies cards by content hash. Editing a card resets its progress (this is intentional - you want to relearn improved cards).

---

## Troubleshooting

If something goes wrong, check the logs at `/dev/shm/srs.log` and `/dev/shm/srs_err.log`. Ask Zo for help debugging issues.

---

## Managing the Service

Ask Zo to list, restart, or delete your service. Your progress is stored in `/home/workspace/flashcards/hashcards.db`.

---

## Using Spaced Repetition

Memory is valuable when it helps you do what matters to you. Use SRS for things that serve your goals, not trivia.

**Key principles:**

- Understand first, memorize second
- Keep cards atomic (one fact per card)
- Review daily and maintain emotional connection to your sessions
- Be honest with grading
- Write prompts that require genuine retrieval

Creating good cards forces deep thinking about the material - often more valuable than the reviews themselves. Use the `add-flashcards` command to generate cards from source material.

**Further reading:**

- [How to write good prompts](https://andymatuschak.org/prompts/)
- [Using spaced repetition to see through mathematics](https://cognitivemedium.com/srs-mathematics)
- [Emotional connection in SRS](https://notes.andymatuschak.org/zPiRwRHQxGfF9Zej765PB8M)
- [Memory systems should serve meaningful purposes](https://notes.andymatuschak.org/z4ULp2KUgq3hBCJMWTUnLDX)

---

## Summary

You now have a hashcards instance at `https://srs-<your-username>.zocomputer.io`. Create cards in `/home/workspace/flashcards/` and review daily. Use the `add-flashcards` command to generate cards from source material.

For more information, see the [hashcards documentation](https://github.com/eudoxia0/hashcards).

