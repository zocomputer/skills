#!/usr/bin/env bun

const VAPI_API_KEY = process.env.VAPI_PRIVATE_KEY;
const VAPI_BASE_URL = "https://api.vapi.ai";

if (!VAPI_API_KEY) {
  console.error("Error: VAPI_PRIVATE_KEY environment variable not set");
  process.exit(1);
}

async function vapiRequest(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${VAPI_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${VAPI_API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Vapi API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

async function createAssistant() {
  const assistant = await vapiRequest("/assistant", {
    method: "POST",
    body: JSON.stringify({
      name: "Matt",
      firstMessage: "Hey, this is Matt. What can I help you with?",
      model: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        messages: [
          {
            role: "system",
            content: `You are Matt, a helpful assistant for Nick. You're speaking on the phone so keep responses conversational and concise.

You have access to Nick's calendar, email, and can help with various tasks. Be friendly but efficient.

Key context about Nick:
- CEO and Co-Founder of PeakMetrics
- PeakMetrics is a narrative intelligence platform for detecting and countering disinformation

Keep responses brief - this is a phone call, not a chat. Aim for 1-2 sentences per response unless more detail is specifically requested.`
          }
        ]
      },
      voice: {
        provider: "11labs",
        voiceId: "pwMBn0SsmN1220Aorv15",
      },
      endCallMessage: "Alright, talk to you later!",
      maxDurationSeconds: 1800,
      voicemailDetection: {
        provider: "vapi",
        backoffPlan: {
          startAtSeconds: 2,
          frequencySeconds: 2.5,
          maxRetries: 5
        },
        beepMaxAwaitSeconds: 25
      },
      voicemailMessage: "Hey, this is Matt calling for Nick. Give me a call back when you get a chance. Thanks!",
    }),
  });
  
  console.log("Created assistant:", JSON.stringify(assistant, null, 2));
  return assistant;
}

async function updateAssistant(assistantId: string) {
  const assistant = await vapiRequest(`/assistant/${assistantId}`, {
    method: "PATCH",
    body: JSON.stringify({
      voicemailDetection: {
        provider: "vapi",
        backoffPlan: {
          startAtSeconds: 2,
          frequencySeconds: 2.5,
          maxRetries: 5
        },
        beepMaxAwaitSeconds: 25
      },
      voicemailMessage: "Hey, this is Matt calling for Nick. Give me a call back when you get a chance. Thanks!",
    }),
  });
  
  console.log("Updated assistant:", JSON.stringify(assistant, null, 2));
  return assistant;
}

async function listAssistants() {
  const assistants = await vapiRequest("/assistant");
  console.log("Assistants:", JSON.stringify(assistants, null, 2));
  return assistants;
}

async function updatePhoneNumber(phoneNumberId: string, assistantId: string) {
  const result = await vapiRequest(`/phone-number/${phoneNumberId}`, {
    method: "PATCH",
    body: JSON.stringify({
      assistantId: assistantId,
    }),
  });
  
  console.log("Updated phone number:", JSON.stringify(result, null, 2));
  return result;
}

async function listPhoneNumbers() {
  const numbers = await vapiRequest("/phone-number");
  console.log("Phone numbers:", JSON.stringify(numbers, null, 2));
  return numbers;
}

interface CallOptions {
  voicemailMessage?: string;
  purpose?: string;
  context?: string;
}

function generateVoicemailMessage(options: CallOptions): string {
  if (options.voicemailMessage) {
    return options.voicemailMessage;
  }
  
  if (options.purpose) {
    return `Hey, this is Matt calling for Nick. ${options.purpose} Give me a call back when you get a chance. Thanks!`;
  }
  
  return "Hey, this is Matt calling for Nick. Give me a call back when you get a chance. Thanks!";
}

async function makeCall(toNumber: string, assistantId: string, fromNumberId: string, options: CallOptions = {}) {
  const voicemailMessage = generateVoicemailMessage(options);
  
  const callPayload: Record<string, unknown> = {
    assistantId: assistantId,
    phoneNumberId: fromNumberId,
    customer: {
      number: toNumber,
    },
    assistantOverrides: {
      voicemailMessage: voicemailMessage,
    },
  };
  
  if (options.context) {
    (callPayload.assistantOverrides as Record<string, unknown>).model = {
      messages: [
        {
          role: "system",
          content: `Additional context for this call: ${options.context}`
        }
      ]
    };
  }
  
  const call = await vapiRequest("/call", {
    method: "POST",
    body: JSON.stringify(callPayload),
  });
  
  console.log("Call initiated:", JSON.stringify(call, null, 2));
  return call;
}

async function listCalls() {
  const calls = await vapiRequest("/call");
  console.log("Calls:", JSON.stringify(calls, null, 2));
  return calls;
}

function parseCallOptions(args: string[]): CallOptions {
  const options: CallOptions = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === "--purpose" && value) {
      options.purpose = value;
      i++;
    } else if (flag === "--voicemail" && value) {
      options.voicemailMessage = value;
      i++;
    } else if (flag === "--context" && value) {
      options.context = value;
      i++;
    }
  }
  return options;
}

// CLI
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

switch (command) {
  case "assistant":
    if (arg1 === "create") {
      await createAssistant();
    } else if (arg1 === "list") {
      await listAssistants();
    } else if (arg1 === "update" && arg2) {
      await updateAssistant(arg2);
    }
    break;
  case "phone":
    if (arg1 === "list") {
      await listPhoneNumbers();
    } else if (arg1 === "attach" && arg2) {
      const assistantIdForPhone = process.argv[5];
      await updatePhoneNumber(arg2, assistantIdForPhone);
    }
    break;
  case "call": {
    if (!arg1) {
      console.error("Usage: bun vapi.ts call <to-number> [assistant-id] [options]");
      process.exit(1);
    }
    
    const toNumber = arg1;
    let assistantIdArg = arg2;
    let optionStartIndex = 4;
    
    // Check if arg2 is a flag or an assistant ID
    if (arg2 && arg2.startsWith("--")) {
      assistantIdArg = undefined;
      optionStartIndex = 3;
    }
    
    const options = parseCallOptions(process.argv.slice(optionStartIndex));
    
    const numbers = await vapiRequest("/phone-number");
    const fromNumberId = numbers[0]?.id;
    if (!fromNumberId) {
      console.error("No phone number configured");
      process.exit(1);
    }
    
    if (!assistantIdArg) {
      const assistants = await vapiRequest("/assistant");
      const defaultAssistant = assistants[0];
      if (!defaultAssistant) {
        console.error("No assistant configured");
        process.exit(1);
      }
      await makeCall(toNumber, defaultAssistant.id, fromNumberId, options);
    } else {
      await makeCall(toNumber, assistantIdArg, fromNumberId, options);
    }
    break;
  }
  case "calls":
    await listCalls();
    break;
  default:
    console.log(`Usage:
  bun vapi.ts assistant create     - Create a new assistant (with voicemail detection)
  bun vapi.ts assistant list       - List all assistants
  bun vapi.ts assistant update <id> - Add voicemail detection to existing assistant
  bun vapi.ts phone list           - List phone numbers
  bun vapi.ts phone attach <phone-id> <assistant-id> - Attach assistant to phone
  bun vapi.ts call <to-number> [assistant-id] [options] - Make outbound call
    Options:
      --purpose "reason"      - Auto-generates contextual voicemail
      --voicemail "message"   - Exact voicemail message to leave
      --context "info"        - Extra context for the assistant
  bun vapi.ts calls                - List call history

Examples:
  bun vapi.ts call +15551234567 --purpose "Following up on the investor deck"
  bun vapi.ts call +15551234567 --voicemail "Hey, Nick wanted me to reach out about tomorrow's meeting."
  bun vapi.ts call +15551234567 abc123 --purpose "Confirming lunch" --context "12pm at Marea"`);
}
