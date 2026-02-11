#!/usr/bin/env bun

import { appendFileSync, readFileSync, writeFileSync, existsSync } from "fs";

const LOG_FILE = "/tmp/vapi-debug.log";
function log(...args: any[]) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : a).join(' ')}\n`;
  console.log(...args);
  try { appendFileSync(LOG_FILE, msg); } catch {}
}

// Configuration from environment variables
const PORT = parseInt(process.env.VAPI_WEBHOOK_PORT || "4242");
const DB_PATH = process.env.VAPI_DB_PATH || "/home/workspace/Datasets/vapi-calls/data.duckdb";
const OWNER_PHONE = process.env.VAPI_OWNER_PHONE || ""; // Phone number for auto-auth (e.g., +18189139626)
const ZO_TOKEN = process.env.ZO_CLIENT_IDENTITY_TOKEN || "";
const CALENDAR_ID = process.env.VAPI_CALENDAR_ID || ""; // Primary calendar for bookings
const WORK_CALENDAR_ID = process.env.VAPI_WORK_CALENDAR_ID || CALENDAR_ID; // Secondary calendar to check availability
const TIMEZONE = process.env.VAPI_TIMEZONE || "America/Los_Angeles";

// Assistant configuration
const ASSISTANT_NAME = process.env.VAPI_ASSISTANT_NAME || "Assistant";
const OWNER_NAME = process.env.VAPI_OWNER_NAME || "the owner";
const OWNER_CONTEXT = process.env.VAPI_OWNER_CONTEXT || ""; // e.g., "CEO of Acme Corp"
const VOICE_ID = process.env.VAPI_VOICE_ID || "7EzWGsX10sAS4c9m9cPf";
const VOICE_MODEL = process.env.VAPI_VOICE_MODEL || "eleven_flash_v2_5";
const LLM_MODEL = process.env.VAPI_LLM_MODEL || "claude-sonnet-4-20250514";
const SECURITY_PIN = process.env.VAPI_SECURITY_PIN || ""; // DTMF PIN for non-owner callers

// Google OAuth credentials paths
const TOKEN_PATH = process.env.GOOGLE_TOKEN_PATH || "/home/.z/google-oauth/token.json";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  obtained_at: string;
  client_id: string;
  client_secret: string;
}

async function getValidAccessToken(): Promise<string> {
  try {
    if (!existsSync(TOKEN_PATH)) {
      throw new Error(`Google OAuth token not found at ${TOKEN_PATH}`);
    }
    const tokenData: TokenData = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
    const obtainedAt = new Date(tokenData.obtained_at).getTime();
    const expiresAt = obtainedAt + (tokenData.expires_in * 1000) - 60000; // 1 min buffer
    
    if (Date.now() < expiresAt) {
      return tokenData.access_token;
    }
    
    // Token expired, refresh it
    log("Refreshing Google access token...");
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: tokenData.client_id,
        client_secret: tokenData.client_secret,
        refresh_token: tokenData.refresh_token,
        grant_type: "refresh_token"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const newToken = await response.json();
    const updatedTokenData = {
      ...tokenData,
      access_token: newToken.access_token,
      expires_in: newToken.expires_in,
      obtained_at: new Date().toISOString()
    };
    
    writeFileSync(TOKEN_PATH, JSON.stringify(updatedTokenData, null, 2));
    log("Token refreshed successfully");
    return newToken.access_token;
  } catch (e) {
    log("Error getting access token:", e);
    throw e;
  }
}

// Initialize DuckDB
async function initDb() {
  const proc = Bun.spawn(["duckdb", DB_PATH, "-c", `
    CREATE TABLE IF NOT EXISTS calls (
      id VARCHAR PRIMARY KEY,
      phone_number VARCHAR,
      direction VARCHAR,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      duration_seconds INTEGER,
      summary TEXT,
      transcript TEXT,
      cost DECIMAL(10,4),
      raw_data JSON
    );
  `]);
  await proc.exited;
}

async function sendRecapEmail(data: any, transcript: string, summary: string) {
  log("sendRecapEmail called with transcript length:", transcript?.length || 0);

  if (!ZO_TOKEN) {
    log("ERROR: ZO_TOKEN is not set!");
    return;
  }

  const call = data.message?.call || data.call || {};
  const phone = call.customer?.number || "Unknown";
  const direction = call.type === "outboundPhoneCall" ? "Outbound" : "Inbound";
  const durationSecs = data.message?.durationSeconds || 0;
  const durationMins = Math.round(durationSecs / 60 * 10) / 10;
  const date = new Date().toLocaleString("en-US", { timeZone: TIMEZONE });
  
  const subject = `Voice Call Recap: ${direction} call ${direction === "Outbound" ? "to" : "from"} ${phone}`;
  
  const body = `## Call Details
- **Direction:** ${direction}
- **Phone:** ${phone}
- **Date:** ${date}
- **Duration:** ${durationSecs < 60 ? `${Math.round(durationSecs)} seconds` : `~${durationMins} min`}

## Summary
${summary || "No summary available."}

## Transcript
${transcript || "No transcript available."}
`;

  try {
    const prompt = `Send an email to the user using send_email_to_user with:
Subject: ${subject}

Body (markdown):
${body}`;

    fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: {
        "Authorization": ZO_TOKEN.startsWith("Bearer") ? ZO_TOKEN : `Bearer ${ZO_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ input: prompt })
    }).then(r => r.ok ? log("Recap email sent") : log("Recap email failed"));
  } catch (e) {
    log("Error sending recap email:", e);
  }
}

async function createCalendarEvent(params: {
  title: string;
  dateTime: string;
  duration?: number;
  attendeeName?: string;
  attendeePhone?: string;
  description?: string;
}): Promise<{ success: boolean; message: string }> {
  log("createCalendarEvent called with params:", JSON.stringify(params));

  if (!params || !params.title || !params.dateTime) {
    log("ERROR: Missing required params");
    return { success: false, message: "Missing required title or dateTime" };
  }

  if (!CALENDAR_ID) {
    log("ERROR: VAPI_CALENDAR_ID not configured");
    return { success: false, message: "Calendar not configured" };
  }

  const { title, dateTime, duration = 30, attendeeName, attendeePhone, description } = params;

  try {
    const accessToken = await getValidAccessToken();

    // Parse the dateTime to get actual date and time
    const parsedDateTime = parseDateTimeString(dateTime);
    log("Parsed dateTime:", parsedDateTime);

    // Create event using events.insert API for precise timezone control
    // Format datetime as local time (YYYY-MM-DDTHH:MM:SS without Z)
    const formatLocalDateTime = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:00`;
    };

    const endTime = new Date(parsedDateTime.getTime() + duration * 60000);

    const eventBody = {
      summary: title,
      description: [
        attendeeName ? `Attendee: ${attendeeName}` : null,
        attendeePhone ? `Phone: ${attendeePhone}` : null,
        description || null
      ].filter(Boolean).join("\n") || undefined,
      start: {
        dateTime: formatLocalDateTime(parsedDateTime),
        timeZone: TIMEZONE
      },
      end: {
        dateTime: formatLocalDateTime(endTime),
        timeZone: TIMEZONE
      }
    };

    log("Creating event:", JSON.stringify(eventBody));

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventBody)
      }
    );

    const result = await response.json();
    log("Calendar insert response:", response.status, JSON.stringify(result).substring(0, 200));

    if (response.ok && result.id) {
      // Format confirmation message using the parsed values directly
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const h = parsedDateTime.getHours();
      const m = parsedDateTime.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const hour12 = h % 12 || 12;
      const timeStr = m === 0 ? `${hour12} ${ampm}` : `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
      const startStr = `${weekdays[parsedDateTime.getDay()]}, ${months[parsedDateTime.getMonth()]} ${parsedDateTime.getDate()} at ${timeStr}`;
      return { success: true, message: `Booked: ${title} for ${startStr}` };
    } else {
      log("Calendar API error:", result);
      return { success: false, message: "Failed to create event" };
    }
  } catch (e) {
    log("Error creating calendar event:", e);
    return { success: false, message: "Error creating event" };
  }
}

function parseDateTimeString(dateTimeStr: string): Date {
  const now = new Date();
  const lower = dateTimeStr.toLowerCase();

  // Extract time (e.g., "7am", "2:30pm", "14:00")
  let hours = 9; // default to 9am
  let minutes = 0;

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    hours = parseInt(timeMatch[1]);
    minutes = parseInt(timeMatch[2] || "0");
    if (timeMatch[3] === "pm" && hours < 12) hours += 12;
    if (timeMatch[3] === "am" && hours === 12) hours = 0;
  }

  // Extract date
  let targetDate = new Date(now);

  if (lower.includes("today")) {
    // keep targetDate as today
  } else if (lower.includes("tomorrow")) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes("monday")) {
    targetDate = getNextDayOfWeek(now, 1);
  } else if (lower.includes("tuesday")) {
    targetDate = getNextDayOfWeek(now, 2);
  } else if (lower.includes("wednesday")) {
    targetDate = getNextDayOfWeek(now, 3);
  } else if (lower.includes("thursday")) {
    targetDate = getNextDayOfWeek(now, 4);
  } else if (lower.includes("friday")) {
    targetDate = getNextDayOfWeek(now, 5);
  } else if (lower.includes("saturday")) {
    targetDate = getNextDayOfWeek(now, 6);
  } else if (lower.includes("sunday")) {
    targetDate = getNextDayOfWeek(now, 0);
  }

  // Build the final date
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();

  return new Date(year, month, day, hours, minutes, 0);
}

async function checkAvailability(params: {
  date: string;
  time?: string;
}): Promise<{ available: boolean; busyTimes?: string[]; message: string }> {
  const { date, time } = params;
  log("checkAvailability called with:", params);

  if (!CALENDAR_ID) {
    return { available: true, message: "Calendar not configured - assuming available" };
  }

  try {
    const accessToken = await getValidAccessToken();
    
    // Parse the date to get time range
    const now = new Date();
    let targetDate: Date;
    
    const dateLower = date.toLowerCase();
    if (dateLower === "today") {
      targetDate = now;
    } else if (dateLower === "tomorrow") {
      targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (dateLower.includes("monday")) {
      targetDate = getNextDayOfWeek(now, 1);
    } else if (dateLower.includes("tuesday")) {
      targetDate = getNextDayOfWeek(now, 2);
    } else if (dateLower.includes("wednesday")) {
      targetDate = getNextDayOfWeek(now, 3);
    } else if (dateLower.includes("thursday")) {
      targetDate = getNextDayOfWeek(now, 4);
    } else if (dateLower.includes("friday")) {
      targetDate = getNextDayOfWeek(now, 5);
    } else if (dateLower.includes("saturday")) {
      targetDate = getNextDayOfWeek(now, 6);
    } else if (dateLower.includes("sunday")) {
      targetDate = getNextDayOfWeek(now, 0);
    } else {
      targetDate = new Date(date);
      if (isNaN(targetDate.getTime())) {
        targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + 1);
      }
    }

    // Set to business hours (8am-6pm in configured timezone)
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    const timeMin = new Date(`${targetDateStr}T16:00:00.000Z`); // 8am Pacific
    const timeMax = new Date(`${targetDateStr}T02:00:00.000Z`);
    timeMax.setDate(timeMax.getDate() + 1); // 6pm Pacific = 2am UTC next day
    
    log("Querying freeBusy:", { date: targetDateStr, timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() });

    const calendarsToCheck = [{ id: CALENDAR_ID }];
    if (WORK_CALENDAR_ID && WORK_CALENDAR_ID !== CALENDAR_ID) {
      calendarsToCheck.push({ id: WORK_CALENDAR_ID });
    }

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: TIMEZONE,
        items: calendarsToCheck
      })
    });

    const result = await response.json();
    log("FreeBusy response:", response.status, JSON.stringify(result).substring(0, 300));

    if (response.ok) {
      // Combine busy periods from all calendars
      let busyPeriods: any[] = [];
      for (const cal of calendarsToCheck) {
        const calBusy = result.calendars?.[cal.id]?.busy || [];
        busyPeriods = busyPeriods.concat(calBusy);
      }

      if (busyPeriods.length === 0) {
        return { available: true, message: `${date} is completely free during business hours.` };
      }
      
      // Format busy times
      const busyDescriptions = busyPeriods.map((period: any) => {
        const start = new Date(period.start);
        const end = new Date(period.end);
        const startStr = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });
        const endStr = end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TIMEZONE });
        return `${startStr}-${endStr}`;
      });
      
      return { 
        available: true, 
        busyTimes: busyDescriptions,
        message: `On ${date}, ${OWNER_NAME} is busy: ${busyDescriptions.join(", ")}. Other times are free.`
      };
    } else {
      log("FreeBusy API error:", result);
      return { available: true, message: `${date} likely has availability during business hours.` };
    }
  } catch (e) {
    log("Error checking availability:", e);
    return { available: true, message: `${date} likely has availability. What time works?` };
  }
}

function getNextDayOfWeek(from: Date, dayOfWeek: number): Date {
  const result = new Date(from);
  const currentDay = result.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;
  result.setDate(result.getDate() + daysUntil);
  return result;
}

async function insertCall(data: any) {
  const call = data.message?.call || data.call || {};
  const id = call.id || `call_${Date.now()}`;
  const phone = call.customer?.number || "unknown";
  const direction = call.type || "inbound";
  const startedAt = call.startedAt || new Date().toISOString();
  const endedAt = call.endedAt || new Date().toISOString();
  const duration = Math.round(data.message?.durationSeconds || 0);
  const summary = data.message?.summary || data.message?.analysis?.summary || "";
  const transcript = data.message?.artifact?.transcript || call.artifact?.transcript || call.transcript || "";
  const cost = call.cost || 0;
  
  // Use parameterized query via Python to prevent SQL injection
  const safeInsertScript = `
import duckdb
import json
import sys

data = json.loads(sys.stdin.read())
con = duckdb.connect(data['db'])
con.execute('''
  INSERT OR REPLACE INTO calls VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', [data['id'], data['phone'], data['direction'], data['startedAt'], 
      data['endedAt'], data['duration'], data['summary'], data['transcript'],
      data['cost'], data['raw']])
con.close()
`;
  
  const inputData = JSON.stringify({
    db: DB_PATH,
    id, phone, direction, startedAt, endedAt, duration,
    summary, transcript, cost: Number(cost), raw: JSON.stringify(data)
  });
  
  const proc = Bun.spawn(["python3", "-c", safeInsertScript], {
    stdin: "pipe"
  });
  proc.stdin.write(inputData);
  proc.stdin.end();
  await proc.exited;
  
  log(`Saved call ${id} from ${phone}, duration: ${duration}s`);
  
  sendRecapEmail(data, transcript, summary); // Fire and forget
}

async function getCallHistory(phoneNumber: string): Promise<string> {
  if (!phoneNumber) return "";
  
  const normalized = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
  
  // Use parameterized query via Python to prevent SQL injection
  const safeQueryScript = `
import duckdb
import json
import sys

data = json.loads(sys.stdin.read())
con = duckdb.connect(data['db'])
result = con.execute('''
  SELECT started_at, direction, summary, transcript 
  FROM calls 
  WHERE phone_number LIKE ? 
  ORDER BY started_at DESC 
  LIMIT 5
''', ['%' + data['phone'] + '%']).fetchall()
con.close()

columns = ['started_at', 'direction', 'summary', 'transcript']
print(json.dumps([dict(zip(columns, row)) for row in result]))
`;
  
  const inputData = JSON.stringify({ db: DB_PATH, phone: normalized });
  
  const proc = Bun.spawn(["python3", "-c", safeQueryScript], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe"
  });
  proc.stdin.write(inputData);
  proc.stdin.end();
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  
  try {
    const calls = JSON.parse(output || "[]");
    if (calls.length === 0) return "";
    
    let history = "PREVIOUS CALL HISTORY WITH THIS NUMBER:\n";
    for (const call of calls) {
      const date = new Date(call.started_at).toLocaleDateString();
      const dir = call.direction === "outboundPhoneCall" ? "Outbound" : "Inbound";
      history += `\n--- ${dir} call on ${date} ---\n`;
      if (call.summary) history += `Summary: ${call.summary}\n`;
      if (call.transcript) {
        const t = call.transcript.length > 500 ? call.transcript.slice(0, 500) + "..." : call.transcript;
        history += `Transcript: ${t}\n`;
      }
    }
    return history;
  } catch (e) {
    log("Error parsing call history:", e);
    return "";
  }
}

function isOwnerPhone(phoneNumber: string): boolean {
  if (!phoneNumber || !OWNER_PHONE) return false;
  const normalizedOwner = OWNER_PHONE.replace(/[^0-9]/g, '').slice(-10);
  const normalizedCaller = phoneNumber.replace(/[^0-9]/g, '').slice(-10);
  return normalizedCaller === normalizedOwner;
}

await initDb();
log(`Vapi webhook server starting on port ${PORT}...`);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    if (req.method === "GET") return new Response("OK", { status: 200 });
    if (req.method !== "POST") return new Response("OK", { status: 200 });
    
    try {
      const data = await req.json();
      const messageType = data.message?.type || data.type;
      
      log(`Received webhook: ${messageType}`);
      
      if (messageType === "tool-calls") {
        log("Tool-calls webhook received");
        const toolCalls = data.message?.toolCalls || data.message?.toolCallList || [];
        const results = [];
        
        for (const toolCall of toolCalls) {
          const toolName = toolCall.function?.name;
          const rawParams = toolCall.function?.arguments || "{}";
          const params = typeof rawParams === "string" ? JSON.parse(rawParams) : rawParams;
          const callId = toolCall.id;

          log(`Processing tool: ${toolName}`, JSON.stringify(params));
          
          if (toolName === "createCalendarEvent") {
            const result = await createCalendarEvent(params);
            results.push({ name: toolName, toolCallId: callId, result: JSON.stringify(result) });
          } else if (toolName === "checkAvailability") {
            const result = await checkAvailability(params);
            results.push({ name: toolName, toolCallId: callId, result: JSON.stringify(result) });
          } else {
            results.push({ name: toolName, toolCallId: callId, result: JSON.stringify({ success: false, message: `Unknown tool: ${toolName}` }) });
          }
        }
        
        log("Returning tool results:", results);
        return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      
      if (messageType === "assistant-request") {
        const customerNumber = data.message?.call?.customer?.number || "";
        log(`Assistant request for: ${customerNumber}`);
        
        const history = await getCallHistory(customerNumber);
        const isOwner = isOwnerPhone(customerNumber);
        
        let securitySection: string;
        if (isOwner) {
          securitySection = `AUTHENTICATION: This call is from ${OWNER_NAME}'s phone. Full access granted.`;
        } else {
          const pinSection = SECURITY_PIN 
            ? `REQUIRES PIN (${SECURITY_PIN}): Email, personal details, other actions.`
            : "";
          securitySection = `SECURITY RULES:
ALLOWED: Check availability, book appointments, general questions.
${pinSection}

BOOKING FLOW:
1. Call checkAvailability first to see free times
2. Get caller's name
3. Use createCalendarEvent to book

STYLE: Answer directly. 1-2 sentences. Say "One moment" once when using tools, then wait silently.`;
        }
        
        const contextLine = OWNER_CONTEXT ? ` ${OWNER_CONTEXT}.` : "";
        const systemPrompt = `You are ${ASSISTANT_NAME}, ${OWNER_NAME}'s assistant.${contextLine}
Never say you're an AI. Just say you're ${ASSISTANT_NAME}, ${OWNER_NAME}'s assistant.
${history ? history + "\n" : ""}${securitySection}
Keep responses brief. This is a phone call.`;

        const response = {
          assistant: {
            name: ASSISTANT_NAME,
            firstMessage: isOwner ? `Hey ${OWNER_NAME.split(' ')[0]}, what's up?` : `Hey, this is ${ASSISTANT_NAME}, ${OWNER_NAME}'s assistant. How can I help?`,
            model: {
              provider: "anthropic",
              model: LLM_MODEL,
              messages: [{ role: "system", content: systemPrompt }],
              tools: [
                {
                  type: "function",
                  function: {
                    name: "checkAvailability",
                    description: `Check ${OWNER_NAME}'s calendar availability. Always use this before booking.`,
                    parameters: {
                      type: "object",
                      properties: {
                        date: { type: "string", description: "Date to check, e.g., 'tomorrow', 'Monday'" },
                        time: { type: "string", description: "Optional time, e.g., '2pm'" }
                      },
                      required: ["date"]
                    }
                  }
                },
                {
                  type: "function",
                  function: {
                    name: "createCalendarEvent",
                    description: `Book a meeting on ${OWNER_NAME}'s calendar after confirming availability.`,
                    parameters: {
                      type: "object",
                      properties: {
                        title: { type: "string", description: "Meeting title" },
                        dateTime: { type: "string", description: "Date and time, e.g., 'Monday at 9am'" },
                        duration: { type: "number", description: "Duration in minutes, default 30" },
                        attendeeName: { type: "string", description: "Caller's name" },
                        description: { type: "string", description: "Meeting purpose" }
                      },
                      required: ["title", "dateTime"]
                    }
                  }
                }
              ]
            },
            voice: { provider: "11labs", voiceId: VOICE_ID, model: VOICE_MODEL },
            voicemailMessage: `Hey, it's ${ASSISTANT_NAME} for ${OWNER_NAME}. Call us back. Goodbye.`,
            endCallMessage: "Goodbye.",
            endCallPhrases: ["goodbye", "bye", "talk to you later"],
            maxDurationSeconds: 1800,
            serverMessages: ["end-of-call-report", "tool-calls"]
          }
        };
        
        return new Response(JSON.stringify(response), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      
      if (messageType === "end-of-call-report") {
        log("Saving end-of-call report");
        await insertCall(data);
      }
      
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      log("Webhook error:", e);
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }
});

log(`Vapi webhook server running on port ${PORT}`);
