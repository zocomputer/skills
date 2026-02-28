import { parseArgs } from "util";
import * as fs from "fs";
import * as path from "path";

// Configuration
const API_KEY = process.env.FABRIC_API_KEY;
const BASE_URL = "https://api.fabric.so";

// Rate limiting configuration
const RATE_LIMIT = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  requestsPerSecond: 10,
};

// Track request timestamps for rate limiting
const requestTimestamps: number[] = [];

// Error types for better handling
class FabricError extends Error {
  constructor(
    message: string,
    public status?: number,
    public detail?: string,
    public traceId?: string
  ) {
    super(message);
    this.name = "FabricError";
  }
}

class RateLimitError extends FabricError {
  constructor(retryAfter?: number) {
    super(`Rate limit exceeded. Retry after ${retryAfter || "unknown"} seconds`, 429);
    this.name = "RateLimitError";
  }
}

class StorageLimitError extends FabricError {
  constructor(detail: string) {
    super(`Storage limit exceeded: ${detail}`, 403, detail);
    this.name = "StorageLimitError";
  }
}

// Rate limiting helper
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const oneSecondAgo = now - 1000;
  
  // Remove timestamps older than 1 second
  while (requestTimestamps.length > 0 && requestTimestamps[0] < oneSecondAgo) {
    requestTimestamps.shift();
  }
  
  // If we've hit the limit, wait
  if (requestTimestamps.length >= RATE_LIMIT.requestsPerSecond) {
    const oldestInWindow = requestTimestamps[0];
    const waitTime = oldestInWindow + 1000 - now;
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  requestTimestamps.push(Date.now());
}

// Retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = RATE_LIMIT.maxRetries
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await waitForRateLimit();
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry non-rate-limit errors
      if (error.status !== 429) {
        throw error;
      }
      
      // Last attempt, throw the error
      if (attempt === retries) {
        throw new RateLimitError();
      }
      
      // Calculate backoff delay with jitter
      const delay = Math.min(
        RATE_LIMIT.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        RATE_LIMIT.maxDelayMs
      );
      
      console.error(`Rate limited. Retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// API request helper with rate limiting
async function fabricRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  return withRetry(async () => {
    const url = `${BASE_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "X-Api-Key": API_KEY!,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorDetail = errorText;
      let traceId: string | undefined;
      
      try {
        const errorJson = JSON.parse(errorText);
        errorDetail = errorJson.detail || errorText;
        traceId = errorJson.traceid;
      } catch (e) {}
      
      // Handle specific error types
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        throw new RateLimitError(retryAfter ? parseInt(retryAfter) : undefined);
      }
      
      if (response.status === 403 && errorDetail.includes("storage")) {
        throw new StorageLimitError(errorDetail);
      }
      
      throw new FabricError(
        `Fabric API Error (${response.status}): ${errorDetail}`,
        response.status,
        errorDetail,
        traceId
      );
    }

    // Handle empty responses
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  });
}

// ============================================
// FILE UPLOAD FUNCTIONS (3-step process)
// ============================================

interface SignedUploadResponse {
  url: string;
  headers: Record<string, string>;
  path: string;
}

async function getSignedUploadUrl(
  filename: string,
  fileSize: number
): Promise<SignedUploadResponse> {
  const response = await fabricRequest<SignedUploadResponse>(
    `/v2/upload?filename=${encodeURIComponent(filename)}&size=${fileSize}`
  );
  return response;
}

async function uploadFileToSignedUrl(
  signedUrl: string,
  headers: Record<string, string>,
  filePath: string
): Promise<void> {
  const fileBuffer = fs.readFileSync(filePath);
  
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: headers,
    body: fileBuffer,
  });
  
  if (!response.ok) {
    throw new Error(`File upload failed: ${response.status} ${response.statusText}`);
  }
}

async function createFileResource(
  filePath: string,
  filename: string,
  parentId: string,
  mimeType: string
): Promise<any> {
  return fabricRequest("/v2/files", {
    method: "POST",
    body: JSON.stringify({
      attachment: {
        path: filePath,
        filename: filename,
      },
      parentId: parentId,
      mimeType: mimeType,
    }),
  });
}

// Get MIME type from file extension
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".zip": "application/zip",
    ".json": "application/json",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".csv": "text/csv",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

// ============================================
// CLI IMPLEMENTATION
// ============================================

const usage = `
Fabric.so CLI - Interact with your Fabric knowledge base

Usage: bun fabric.ts <command> [options]

ACCOUNT
  me                              Get account details

RESOURCES - LIST & SEARCH
  list [options]                  List recent resources
    --limit <n>                   Number of results (default: 10)
    --parent <id>                 Filter by parent ID
    --order <field>               Order by: createdAt, modifiedAt (default: createdAt)
  search <query> [options]        Search your Fabric library
    --limit <n>                   Number of results (default: 20)
    --kinds <types>               Filter by kind (comma-sep: bookmark,notepad,image,folder)
    --tags <names>                Filter by tags (comma-separated)
  get <id>                        Get a specific resource by ID
  children <parentId>             List children of a folder/resource

FOLDERS & SPACES
  roots                           List top-level folders (resource roots)
  folders [options]               List all folders
    --parent <id>                 Filter by parent ID
  create-folder <name> [options]  Create a new folder
    --parent <id>                 Parent folder (default: Inbox)
  create-space <name>             Create a new space (top-level folder)

BOOKMARKS
  create-bookmark <url> [options] Add a bookmark
    --parent <id>                 Parent folder (default: Inbox)
    --tags <names>                Comma-separated tags
  update-bookmark <id> [options]  Update a bookmark
    --url <url>                   New URL
    --name <name>                 New name
    --tags <names>                New tags (replaces existing)

NOTES
  create-note <name> [text] [opts] Create a note (markdown supported)
    --parent <id>                 Parent folder (default: Inbox)
    --tags <names>                Comma-separated tags
  update-note <id> [text]         Update note content
  append-note <id> <text>         Append text to existing note

FILES
  upload <filepath> [options]     Upload a file
    --parent <id>                 Parent folder (default: Inbox)
    --name <name>                 Custom filename

TAGS
  tags                            List all tags

DELETE
  delete <id>                     Delete a resource

OPTIONS
  -h, --help                      Show this help message
  --json                          Output raw JSON response

EXAMPLES
  bun fabric.ts search "badminton tournament"
  bun fabric.ts create-note "Meeting Notes" "Discussed Q1 goals"
  bun fabric.ts create-bookmark "https://example.com" --tags "ideas,reference"
  bun fabric.ts upload ./report.pdf --parent "@alias::inbox"
  bun fabric.ts create-folder "Projects" --parent "@alias::inbox"
`;

interface ParsedArgs {
  command: string;
  positionals: string[];
  values: Record<string, any>;
  json: boolean;
}

async function main() {
  // Check API key
  if (!API_KEY) {
    console.error("Error: FABRIC_API_KEY environment variable is not set.");
    console.error("Please add it in Settings > Advanced > Secrets.");
    process.exit(1);
  }

  const args = Bun.argv.slice(2);
  const { values, positionals } = parseArgs({
    args,
    options: {
      help: { type: "boolean", short: "h" },
      json: { type: "boolean", default: false },
      limit: { type: "string" },
      parent: { type: "string" },
      order: { type: "string" },
      tags: { type: "string" },
      kinds: { type: "string" },
      url: { type: "string" },
      name: { type: "string" },
    },
    allowPositionals: true,
  });

  if (values.help || positionals.length === 0) {
    console.log(usage);
    process.exit(0);
  }

  const command = positionals[0];
  const cmdPositionals = positionals.slice(1);
  const json = values.json || false;

  // Helper for output
  const output = (data: any) => {
    if (json) {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  };

  try {
    switch (command) {
      // ==================== ACCOUNT ====================
      case "me": {
        const me = await fabricRequest("/v2/user/me");
        if (json) {
          output(me);
        } else {
          console.log("Account Details:");
          console.log(`Name: ${me.name}`);
          console.log(`Email: ${me.email}`);
        }
        break;
      }

      // ==================== LIST & SEARCH ====================
      case "list": {
        const limit = values.limit ? parseInt(values.limit) : 10;
        const resources = await fabricRequest("/v2/resources/filter", {
          method: "POST",
          body: JSON.stringify({
            limit,
            order: { 
              property: values.order || "createdAt", 
              direction: "DESC" 
            },
            ...(values.parent && { parentId: values.parent }),
          }),
        });
        output(resources);
        break;
      }

      case "search": {
        const query = cmdPositionals[0];
        if (!query) throw new Error("Search query required");
        
        const limit = values.limit ? parseInt(values.limit) : 20;
        const kinds = values.kinds?.split(",").map((k: string) => k.trim());
        const tags = values.tags?.split(",").map((t: string) => t.trim());
        
        const results = await fabricRequest("/v2/resources/search", {
          method: "POST",
          body: JSON.stringify({
            text: query,
            pagination: { page: 1, pageSize: limit },
            ...(kinds && { filters: { kinds } }),
            ...(tags && { filters: { tags } }),
          }),
        });
        output(results);
        break;
      }

      case "get": {
        const id = cmdPositionals[0];
        if (!id) throw new Error("Resource ID required");
        const resource = await fabricRequest(`/v2/resources/${id}`);
        output(resource);
        break;
      }

      case "children": {
        const parentId = cmdPositionals[0];
        if (!parentId) throw new Error("Parent ID required");
        const children = await fabricRequest("/v2/resources/filter", {
          method: "POST",
          body: JSON.stringify({
            parentId,
            limit: 100,
          }),
        });
        output(children);
        break;
      }

      // ==================== FOLDERS & SPACES ====================
      case "roots": {
        const roots = await fabricRequest("/v2/resource-roots");
        output(roots);
        break;
      }

      case "folders": {
        const folders = await fabricRequest("/v2/folders", {
          method: "POST",
          body: JSON.stringify({
            limit: 100,
            ...(values.parent && { parentId: values.parent }),
          }),
        });
        output(folders);
        break;
      }

      case "create-folder": {
        const name = cmdPositionals[0];
        if (!name) throw new Error("Folder name required");
        
        const folder = await fabricRequest("/v2/folders", {
          method: "POST",
          body: JSON.stringify({
            name,
            parentId: values.parent || "@alias::inbox",
          }),
        });
        output(folder);
        break;
      }

      case "create-space": {
        const name = cmdPositionals[0];
        if (!name) throw new Error("Space name required");
        
        const space = await fabricRequest("/v2/spaces", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        output(space);
        break;
      }

      // ==================== BOOKMARKS ====================
      case "create-bookmark": {
        const url = cmdPositionals[0];
        if (!url) throw new Error("URL required");
        
        const tags = values.tags?.split(",").map((t: string) => ({ name: t.trim() }));
        
        const bookmark = await fabricRequest("/v2/bookmarks", {
          method: "POST",
          body: JSON.stringify({
            url,
            parentId: values.parent || "@alias::inbox",
            ...(tags && { tags }),
          }),
        });
        output(bookmark);
        break;
      }

      case "update-bookmark": {
        const id = cmdPositionals[0];
        if (!id) throw new Error("Bookmark ID required");
        
        const updates: any = {};
        if (values.url) updates.url = values.url;
        if (values.name) updates.name = values.name;
        if (values.tags) {
          updates.tags = values.tags.split(",").map((t: string) => ({ name: t.trim() }));
        }
        
        const bookmark = await fabricRequest(`/v2/bookmarks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        output(bookmark);
        break;
      }

      // ==================== NOTES ====================
      case "create-note": {
        const noteName = cmdPositionals[0];
        if (!noteName) throw new Error("Note name required");
        
        // Note text can be multiple positional arguments
        const noteText = cmdPositionals.slice(1).join(" ") || "";
        const tags = values.tags?.split(",").map((t: string) => ({ name: t.trim() }));
        
        const note = await fabricRequest("/v2/notepads", {
          method: "POST",
          body: JSON.stringify({
            name: noteName,
            text: noteText,
            parentId: values.parent || "@alias::inbox",
            ...(tags && { tags }),
          }),
        });
        output(note);
        break;
      }

      case "update-note": {
        const id = cmdPositionals[0];
        if (!id) throw new Error("Note ID required");
        
        const newText = cmdPositionals.slice(1).join(" ");
        
        const note = await fabricRequest(`/v2/notepads/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ text: newText }),
        });
        output(note);
        break;
      }

      case "append-note": {
        const id = cmdPositionals[0];
        if (!id) throw new Error("Note ID required");
        
        const appendText = cmdPositionals.slice(1).join(" ");
        if (!appendText) throw new Error("Text to append required");
        
        // First get the existing note
        const existing = await fabricRequest(`/v2/notepads/${id}`);
        const newText = (existing.text || "") + "\n\n" + appendText;
        
        const note = await fabricRequest(`/v2/notepads/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ text: newText }),
        });
        output(note);
        break;
      }

      // ==================== FILES ====================
      case "upload": {
        const filePath = cmdPositionals[0];
        if (!filePath) throw new Error("File path required");
        
        // Resolve to absolute path
        const absolutePath = path.resolve(filePath);
        if (!fs.existsSync(absolutePath)) {
          throw new Error(`File not found: ${absolutePath}`);
        }
        
        const stats = fs.statSync(absolutePath);
        const filename = values.name || path.basename(absolutePath);
        const mimeType = getMimeType(filename);
        const parentId = values.parent || "@alias::inbox";
        
        console.error(`Uploading: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Step 1: Get signed URL
        console.error("Step 1/3: Getting upload URL...");
        const signedResponse = await getSignedUploadUrl(filename, stats.size);
        
        // Step 2: Upload file
        console.error("Step 2/3: Uploading file...");
        await uploadFileToSignedUrl(signedResponse.url, signedResponse.headers, absolutePath);
        
        // Step 3: Create file resource
        console.error("Step 3/3: Creating resource...");
        const fileResource = await createFileResource(
          signedResponse.path,
          filename,
          parentId,
          mimeType
        );
        
        console.error("Upload complete!");
        output(fileResource);
        break;
      }

      // ==================== TAGS ====================
      case "tags": {
        const tags = await fabricRequest("/v2/tags");
        output(tags);
        break;
      }

      // ==================== DELETE ====================
      case "delete": {
        const id = cmdPositionals[0];
        if (!id) throw new Error("Resource ID required");
        
        await fabricRequest(`/v2/resources/${id}`, {
          method: "DELETE",
        });
        console.log("Resource deleted successfully");
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        console.log(usage);
        process.exit(1);
    }
  } catch (error) {
    if (error instanceof FabricError) {
      console.error(`Error: ${error.message}`);
      if (error.traceId) {
        console.error(`Trace ID: ${error.traceId}`);
      }
    } else if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
    } else {
      console.error("An unexpected error occurred");
    }
    process.exit(1);
  }
}

main();
