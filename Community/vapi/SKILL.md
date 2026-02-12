---
name: vapi
description: Voice AI integration with Vapi. Enables inbound/outbound phone calls with AI voice agents that can check calendars and book appointments.
compatibility: Created for Zo Computer
metadata:
  author: anonymous
---
# Vapi Voice Integration

AI-powered voice assistant that handles phone calls, checks calendar availability, and books appointments.

## Features

- **Inbound calls**: Answer calls with an AI assistant
- **Outbound calls**: Make calls on your behalf
- **Calendar integration**: Check availability and book meetings via Google Calendar
- **Call history**: Remembers previous conversations with callers
- **Security**: Auto-authenticate owner, optional PIN for others
- **Email recaps**: Get summaries after each call

## Installation

### 1. Set up Vapi

1. Create account at [vapi.ai](https://vapi.ai)
2. Get your **Private API Key** from Dashboard → API Keys
3. Purchase or bring a phone number

### 2. Configure Environment Variables

Add these secrets in [Settings → Developers](/?t=settings&s=developers):

**Required:**
```
VAPI_PRIVATE_KEY=your-private-key
```

**Recommended:**
```
VAPI_OWNER_PHONE=+15551234567      # Your phone number (auto-authenticated)
VAPI_OWNER_NAME=Your Name          # Used in prompts
VAPI_CALENDAR_ID=you@gmail.com     # Google Calendar for bookings
```

**Optional:**
```
VAPI_WORK_CALENDAR_ID=work@company.com  # Secondary calendar to check
VAPI_ASSISTANT_NAME=Matt                # Default: "Assistant"
VAPI_OWNER_CONTEXT=CEO of Acme Corp     # Extra context about you
VAPI_TIMEZONE=America/Los_Angeles       # Default timezone
VAPI_SECURITY_PIN=1234                  # DTMF PIN for non-owner callers
VAPI_VOICE_ID=7EzWGsX10sAS4c9m9cPf     # ElevenLabs voice ID
VAPI_VOICE_MODEL=eleven_flash_v2_5      # ElevenLabs model
VAPI_LLM_MODEL=claude-sonnet-4-20250514 # LLM for responses
VAPI_WEBHOOK_PORT=4242                  # Webhook server port
VAPI_DB_PATH=/path/to/calls.duckdb      # Call history database
GOOGLE_TOKEN_PATH=/path/to/token.json   # Google OAuth token
```

### 3. Set up Google Calendar (optional)

For calendar features, you need Google OAuth credentials. Use the `google-direct-oauth` skill or connect via [Settings → Integrations](/?t=settings&s=integrations).

### 4. Register the Webhook Service

```bash
# Register the webhook as a Zo service
zo register-service --label vapi-webhook --protocol http --local-port 4242 \
  --workdir /home/workspace/Skills/zo-vapi/scripts \
  --entrypoint "bun webhook.ts"
```

### 5. Configure Vapi Webhook

In your Vapi dashboard:
1. Go to Account → Webhooks
2. Set Server URL to your webhook URL (from the registered service)
3. Enable events: `assistant-request`, `tool-calls`, `end-of-call-report`

### 6. Attach Assistant to Phone Number

```bash
# List your phone numbers and assistants
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts phone list
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts assistant list

# Attach (creates dynamic assistant via webhook)
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts phone attach <phone-id> <assistant-id>
```

## Usage

### Make Outbound Calls

```bash
# Basic call
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts call +15551234567

# With purpose (generates contextual voicemail)
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts call +15551234567 --purpose "Following up on the meeting"

# With custom voicemail
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts call +15551234567 --voicemail "Hey, just wanted to confirm tomorrow."

# With context for the assistant
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts call +15551234567 --context "Discuss Q4 planning"
```

### Manage Assistants

```bash
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts assistant list
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts assistant create
```

### View Call History

```bash
bun /home/workspace/Skills/zo-vapi/scripts/vapi.ts calls

# Or query directly
duckdb /home/workspace/Datasets/vapi-calls/data.duckdb -c "SELECT * FROM calls ORDER BY started_at DESC LIMIT 10"
```

## How It Works

### Inbound Calls
1. Call comes in → Vapi sends `assistant-request` to webhook
2. Webhook checks caller phone against history and owner number
3. Returns dynamic assistant config with appropriate permissions
4. Assistant handles call with calendar tools
5. Call ends → `end-of-call-report` saves transcript and emails recap

### Security Model
- **Owner phone**: Full access, no PIN required
- **Other callers**: Can check availability and book appointments
- **Protected actions**: Email, personal info require PIN (if configured)

### Calendar Tools
- `checkAvailability`: Queries Google Calendar freeBusy API
- `createCalendarEvent`: Books meetings with proper timezone handling

## Customization

### Change the Voice

Browse voices at [ElevenLabs](https://elevenlabs.io/voice-library) and set:
```
VAPI_VOICE_ID=your-chosen-voice-id
```

### Change the LLM

Vapi supports multiple providers. Set:
```
VAPI_LLM_MODEL=claude-sonnet-4-20250514  # or gpt-4o, etc.
```

### Personalize `vapi.ts`

The `scripts/vapi.ts` CLI has several hardcoded values that should be updated to match your identity and preferences. While environment variables handle API keys and some config, the following are embedded directly in the script:

**Assistant Identity** (`createAssistant` function):
- `name: "Matt"` — Change to your assistant's name
- `firstMessage: "Hey, this is Matt..."` — The greeting callers hear first
- `endCallMessage: "Alright, talk to you later!"` — Said when hanging up

**System Prompt** (`createAssistant` → `model.messages`):
- `"You are Matt, a helpful assistant for Nick"` — Update both names
- `"CEO and Co-Founder of PeakMetrics"` — Replace with your own role/company
- `"PeakMetrics is a narrative intelligence platform..."` — Replace with your company description
- The tone/style instructions (e.g., "1-2 sentences per response") can also be adjusted

**Voice** (`createAssistant` → `voice`):
- `voiceId: "pwMBn0SsmN1220Aorv15"` — Hardcoded ElevenLabs voice ID (overrides `VAPI_VOICE_ID` env var for `assistant create`)

**Voicemail Messages** (appear in multiple places):
- `createAssistant`: `"Hey, this is Matt calling for Nick..."`
- `updateAssistant`: Same hardcoded voicemail message
- `generateVoicemailMessage`: Default and purpose-based voicemail templates both reference "Matt" and "Nick"

> **Tip:** Search for `Matt` and `Nick` in the file to find all instances that need updating. There are currently 6+ references to "Matt" and 4+ references to "Nick" scattered across the assistant config, voicemail templates, and system prompt.

### Extend Tools

Add new tools by modifying `webhook.ts`:
1. Add tool definition in the `assistant-request` response
2. Add handler in the `tool-calls` section
