/**
 * Google OAuth Callback Server
 * Usage: CLIENT_ID=xxx CLIENT_SECRET=xxx REDIRECT_URI=xxx bun run oauth-server.ts
 */

const CLIENT_ID = process.env.CLIENT_ID!;
const CLIENT_SECRET = process.env.CLIENT_SECRET!;
const REDIRECT_URI = process.env.REDIRECT_URI!;
const TOKEN_PATH = "/home/.z/google-oauth/token.json";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

const port = parseInt(process.env.PORT || "8085");

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code: string): Promise<any> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
  });
  return response.json();
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/" || url.pathname === "") {
      const authUrl = buildAuthUrl();
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Google OAuth Setup</title>
          <style>
            body { font-family: system-ui; max-width: 500px; margin: 80px auto; padding: 20px; text-align: center; }
            a.button { display: inline-block; background: #4285f4; color: white; padding: 12px 24px; 
                       text-decoration: none; border-radius: 6px; font-weight: 500; }
            a.button:hover { background: #3367d6; }
          </style>
        </head>
        <body>
          <h1>🔐 Connect Google</h1>
          <p>Click below to authorize access to your Google Calendar and Gmail.</p>
          <p><a class="button" href="${authUrl}">Sign in with Google</a></p>
        </body>
        </html>
      `, { headers: { "Content-Type": "text/html" } });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(`<h1>Error: ${error}</h1>`, { 
          headers: { "Content-Type": "text/html" } 
        });
      }

      if (code) {
        const tokenData = await exchangeCode(code);
        
        if (tokenData.error) {
          return new Response(`<h1>Error: ${tokenData.error}</h1><p>${tokenData.error_description}</p>`, {
            headers: { "Content-Type": "text/html" }
          });
        }

        const toSave = {
          ...tokenData,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          obtained_at: new Date().toISOString(),
        };
        
        await Bun.write(TOKEN_PATH, JSON.stringify(toSave, null, 2));

        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Connected!</title>
            <style>
              body { font-family: system-ui; max-width: 500px; margin: 80px auto; padding: 20px; }
              .success { color: #0a0; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Connected!</h1>
            <p>Zo now has access to your Google Calendar and Gmail.</p>
            <p>You can close this tab.</p>
          </body>
          </html>
        `, { headers: { "Content-Type": "text/html" } });
      }
    }

    return new Response("Not found", { status: 404 });
  },
});

console.log(`OAuth server running on port ${port}`);
console.log(`Redirect URI: ${REDIRECT_URI}`);
