# zo.space Architecture Deep Dive

## System Layout

```
/__substrate/space/               # The space server root
  server.ts                       # Hono entry point (Bun runs this)
  vite.config.ts                  # Vite build config (React + Tailwind)
  package.json                    # All dependencies
  zosite.json                     # Port config (local: 12345, published: 3099)
  node_modules/                   # Pre-installed packages
  dist/                           # Vite build output (SPA)
  assets/                         # User-uploaded static assets
  .errors/                        # Error JSON files per route
  lib/
    utils.ts                      # cn() helper (clsx + tailwind-merge)
    errors.ts                     # Error writing/clearing to .errors/
  routes/
    api/
      index.ts                    # Generated manifest + loader
      {route-name}.ts             # Individual API route handlers
    pages/
      index.ts                    # Generated manifest with lazy imports
      {route-name}.tsx            # Individual page components
  src/
    main.tsx                      # React entry point
    App.tsx                       # BrowserRouter + route rendering
    styles.css                    # Tailwind config + theme variables
    pages/
      Home.tsx                    # Default home page
    components/
      error-boundary.tsx          # React ErrorBoundary with server reporting
      theme-provider.tsx          # Dark/light/system theme via context
      ui/
        card.tsx                  # shadcn Card component
        chart.tsx                 # shadcn Chart component (recharts wrapper)
```

## Request Flow

### Page requests (GET /dashboard, GET /about, etc.)

1. Request hits the Hono server
2. Middleware checks if path starts with `/api/` or `/assets/` -- if so, skip
3. Checks for a static file in `assets/` directory (user-uploaded assets)
4. Checks for a static file in `dist/` (Vite built files like JS, CSS)
5. If path looks like a known static extension (.png, .jpg, etc.) and not found, returns 404
6. Otherwise: SPA fallback -- serves `dist/index.html`
7. React app boots, BrowserRouter matches the path to a page route from `routes/pages/index.ts`
8. The matching component is lazy-loaded and rendered inside ErrorBoundary + Suspense

### API requests (any method to /api/*)

1. Request hits the Hono server
2. Matched by `app.all(path, handler)` for the specific API path
3. The handler function from `routes/api/{name}.ts` is called with the Hono Context
4. On success, the error file for that route is cleared
5. On error, an error JSON is written to `.errors/` and a 500 is returned

### Asset requests (/images/*, /files/*, etc.)

1. If the path matches a file in `/__substrate/space/assets/`, it's served directly
2. Content-Type is inferred from the file
3. Assets are always publicly accessible

## Sync Pipeline (update_space_route internals)

When `update_space_route()` is called, it triggers `/__substrate/space-sync.ts`:

1. Receives all routes as JSON via stdin
2. Clears existing route files (keeps index.ts temporarily)
3. Writes each route's code to the appropriate directory
4. Generates new `index.ts` files for both api/ and pages/
5. Runs `bun install` if node_modules is missing
6. Runs `bun run build` (which runs `vite build`)
7. Restarts the `zo-space` supervisor service
8. Reports success/failure as JSON to stdout

This is a full sync -- ALL routes are written every time. The system doesn't do incremental updates.

## Server Config

From `zosite.json`:
- Local dev port: 12345
- Published port: 3099 (what the proxy forwards to)
- `VITE_HANDLE` env var: set to the user's handle
- `SPACE_ASSETS_DIR`: `./assets`

The server exports Bun's native server format:
```typescript
export default { fetch: app.fetch, port, idleTimeout: 255 };
```

## Process Management

- The server is managed by supervisord as the `zo-space` service
- Logs: `/dev/shm/zo-space.log` (stdout), `/dev/shm/zo-space_err.log` (stderr)
- Proxy logs: `/dev/shm/zosite-3099-proxy.log`
- On crash, supervisord auto-restarts it
- `supervisorctl restart zo-space` to manually restart

## Environment Variables Available

Server-side (API routes via `process.env`):
- `ZO_CLIENT_IDENTITY_TOKEN` -- auth token for calling Zo API
- `VITE_HANDLE` -- user's handle
- `SPACE_ASSETS_DIR` -- path to assets directory
- `PORT` -- server port
- Any secrets added via Settings > Advanced

Client-side (page routes via `import.meta.env`):
- `VITE_HANDLE` -- user's handle
- Any other `VITE_*` variables defined in the build

## Vite Build Config

```typescript
// vite.config.ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react({ fastRefresh: false }), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
```

Notes:
- Uses `@vitejs/plugin-react-swc` (SWC compiler, faster than Babel)
- Fast refresh is disabled (routes are rebuilt fully)
- `@/` alias maps to `/__substrate/space/src/`
- HMR is disabled in server config
