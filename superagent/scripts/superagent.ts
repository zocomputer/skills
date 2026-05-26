#!/usr/bin/env bun
/**
 * Superagent client — sends messages to Aung's Superagent on Base44.
 * Usage: bun run superagent.ts --message "..." [--conversation_id "..."]
 */

const BASE_URL = process.env.SUPERAGENT_BASE44_URL;
if (!BASE_URL) {
  console.error("ERROR: SUPERAGENT_BASE44_URL environment variable not set");
  process.exit(1);
}

interface SuperagentResponse {
  reply?: string;
  error?: string;
  detail?: string;
  [key: string]: unknown;
}

async function sendMessage(message: string, conversationId?: string): Promise<SuperagentResponse> {
  const payload: Record<string, string> = {
    message,
    sender: "Zo",
  };
  if (conversationId) {
    payload.conversation_id = conversationId;
  }

  try {
    const resp = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const body = await resp.text();
      return { error: `HTTP ${resp.status}`, detail: body };
    }

    return (await resp.json()) as SuperagentResponse;
  } catch (err) {
    return { error: "Connection failed", detail: String(err) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let message = "";
  let conversationId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--message" || args[i] === "-m") && i + 1 < args.length) {
      message = args[++i];
    } else if ((args[i] === "--conversation_id" || args[i] === "-c") && i + 1 < args.length) {
      conversationId = args[++i];
    }
  }

  if (!message) {
    console.error("ERROR: --message is required");
    process.exit(1);
  }

  const result = await sendMessage(message, conversationId);
  if (result.error) {
    console.error(`ERROR: ${result.error}`);
    if (result.detail) console.error(`Detail: ${result.detail}`);
    process.exit(1);
  }

  console.log(result.reply ?? JSON.stringify(result));
}

main();
