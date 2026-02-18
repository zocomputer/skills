---
name: zo-space
description: >
  Comprehensive guide for building and managing zo.space routes (pages and APIs).
  Use this skill whenever creating, editing, or debugging zo.space routes.
  Covers architecture, available packages, patterns, limitations, and gotchas.
compatibility: Created for Zo Computer
metadata:
  author: skeletorjs
  version: "1.0"
  category: Community
---

# zo.space Development Guide

Read this skill before creating or editing any zo.space route.
For deeper reference on specific topics, read the files in `references/`.

## Architecture Overview

zo.space is a per-user web presence at `{handle}.zo.space`. It runs:

- **Runtime**: Bun 1.2.x
- **Server framework**: Hono (all HTTP routing)
- **Frontend**: React 19 + Vite 7 (SPA with client-side routing via react-router-dom)
- **Styling**: Tailwind CSS 4 with `@tailwindcss/vite` plugin + tw-animate-css
- **Icons**: `lucide-react` and `@tabler/icons-react` are both available

Routes are NOT files in the user's workspace. They exist only in the space system at `/__substrate/space/routes/`. Manage them exclusively through the space tools.

## Tools

| Tool | Purpose |
|------|---------|
| `list_space_routes()` | List all routes (paths, types, visibility) |
| `get_space_route(path)` | Get a route's full source code |
| `update_space_route(path, route_type, code, public)` | Create or update a route |
| `delete_space_route(path)` | Delete a route |
| `list_space_assets()` | List uploaded static assets |
| `update_space_asset(source_file, asset_path)` | Upload a workspace file as a static asset |
| `delete_space_asset(asset_path)` | Delete an asset |
| `get_space_errors()` | Check for build/runtime errors |

## Route Types

### Page Routes (`route_type="page"`)

React/TSX components rendered client-side. Default export must be a React component.

```tsx
import { useState } from "react";
import { Globe } from "lucide-react";

export default function MyPage() {
  const [count, setCount] = useState(0);
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <Globe className="w-8 h-8 text-primary" />
      <h1 className="text-3xl font-bold">Hello</h1>
      <button onClick={() => setCount(c => c + 1)} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg">
        Clicked {count} times
      </button>
    </div>
  );
}
```

Visibility:
- `public=false` (default): requires auth (only the user can see it)
- `public=true`: anyone can view

Pages are compiled by Vite into the SPA bundle. They run in BrowserRouter, wrapped in ErrorBoundary and Suspense.

### API Routes (`route_type="api"`)

Hono handler functions. Default export must be a function that takes a Hono Context and returns a Response.

```typescript
import type { Context } from "hono";
export default async (c: Context) => {
  return c.json({ message: "Hello from the API" });
};
```

API routes are **always public** regardless of the `public` parameter.

The handler receives ALL HTTP methods through `app.all()`. Check `c.req.method` to handle different methods:

```typescript
import type { Context } from "hono";
export default async (c: Context) => {
  if (c.req.method === "GET") {
    return c.json({ items: [] });
  }
  if (c.req.method === "POST") {
    const body = await c.req.json();
    return c.json({ created: true });
  }
  return c.json({ error: "Method not allowed" }, 405);
};
```

## How the Build Pipeline Works

When you call `update_space_route()`:

1. The route code is written to `/__substrate/space/routes/api/{name}.ts` or `/__substrate/space/routes/pages/{name}.tsx`
2. An index file is regenerated that imports all routes
3. For pages: `vite build` runs, compiling all page routes into the SPA bundle at `/__substrate/space/dist/`
4. For APIs: routes are dynamically imported by the Hono server at startup
5. The `zo-space` supervisor service is restarted

This means:
- **Page route updates trigger a full Vite rebuild.** This takes a few seconds.
- **All page routes are compiled together.** A syntax error in one page can break all pages.
- **API routes are loaded via dynamic import.** An error in one API route won't break others.

Path-to-filename mapping:
- `/` becomes `_home`
- `/hello` becomes `hello`
- `/api/hello` becomes `api-hello`
- `/users/list` becomes `users-list`

Reserved routes that cannot be overwritten:
- `/api/_health` (health check)
- `/api/_error` (client-side error reporting)

## Available Packages

These are pre-installed and available without any extra setup:

### Server-side (API routes):
| Package | Version | Notes |
|---------|---------|-------|
| `hono` | ^4.10.x | Web framework. Import `Context` type from `"hono"` |
| `stripe` | ^17.7.x | Stripe SDK for payment processing |
| `marked` | ^17.0.x | Markdown parser |
| `zod` | ^4.1.x | Schema validation |

API routes also have access to:
- **All Bun APIs**: `Bun.spawn()`, `Bun.file()`, `Bun.write()`, `Bun.serve()`, etc.
- **Node.js built-ins**: `node:fs`, `node:path`, `node:child_process`, etc.
- **`process.env`**: All environment variables including secrets from Settings > Advanced
- **File system**: Full read/write access to `/home/workspace` and the rest of the system
- **Shell commands**: Via `Bun.spawn()` -- can run duckdb, python, etc.
- **Network**: Can make outbound HTTP requests via `fetch()`
- **`ZO_CLIENT_IDENTITY_TOKEN`**: For calling the Zo API (`https://api.zo.computer/zo/ask`)

### Client-side (page routes):
| Package | Use |
|---------|-----|
| `react` / `react-dom` | ^19.2.x |
| `react-router-dom` | ^7.9.x -- client-side routing |
| `lucide-react` | ^0.562.x -- icons |
| `@tabler/icons-react` | ^3.35.x -- icons |
| `recharts` | ^3.6.x -- charts and data viz |
| `@tanstack/react-table` | ^8.21.x -- table component |
| `@dnd-kit/*` | Drag and drop |
| `class-variance-authority` | Variant styling utility |
| `clsx` + `tailwind-merge` | Class name utilities |
| `sonner` | Toast notifications |
| `vaul` | Drawer component |
| `reveal.js` | ^5.2.x -- presentations |
| `next-themes` | Theme switching (dark/light/system) |
| `@tailwindcss/typography` | Prose styling for rendered content |

### Radix UI Primitives (via shadcn/ui pattern):
`avatar`, `checkbox`, `dialog`, `dropdown-menu`, `label`, `select`, `separator`, `slot`, `tabs`, `toggle`, `toggle-group`, `tooltip`

Note: Only `card` and `chart` shadcn components are pre-built in `src/components/ui/`. For other Radix primitives, import directly from `@radix-ui/react-*`.

## Styling

### Tailwind CSS 4

Tailwind 4 uses CSS-first configuration. The theme is defined in `/__substrate/space/src/styles.css` using CSS variables and `@theme inline`.

Key semantic color classes (use these, not raw colors):
- `bg-background` / `text-foreground` -- main page colors
- `bg-card` / `text-card-foreground` -- card surfaces
- `bg-primary` / `text-primary-foreground` -- primary actions
- `bg-secondary` / `text-secondary-foreground` -- secondary elements
- `bg-muted` / `text-muted-foreground` -- subdued content
- `bg-accent` / `text-accent-foreground` -- accents
- `bg-destructive` -- destructive/error actions
- `border-border` -- standard border color
- `bg-input` -- input backgrounds
- `ring-ring` -- focus rings

Chart colors: `text-chart-1` through `text-chart-5`

Dark mode is class-based (`.dark` on `<html>`). The ThemeProvider handles this automatically. All semantic color tokens have dark mode variants defined.

Border radius uses `--radius` variable: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl`.

### tw-animate-css

Animation utilities are available. The `@import "tw-animate-css"` is already included.

### @tailwindcss/typography

The `prose` class is available for rendering rich text/markdown content:
```tsx
<div className="prose dark:prose-invert">
  {/* rendered markdown here */}
</div>
```

## Patterns and Best Practices

### Fetching data from API routes in pages

Pages can call API routes on the same domain using relative URLs:

```tsx
const [data, setData] = useState(null);
useEffect(() => {
  fetch("/api/my-endpoint")
    .then(r => r.json())
    .then(setData);
}, []);
```

### Querying DuckDB from API routes

```typescript
async function queryDb(sql: string): Promise<any[]> {
  const proc = Bun.spawn(["duckdb", "/home/workspace/Data/tasks.db", "-json", "-c", sql], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error(stderr);
  return JSON.parse(stdout || "[]");
}
```

### Calling the Zo API from API routes

```typescript
const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
const response = await fetch("https://api.zo.computer/zo/ask", {
  method: "POST",
  headers: {
    "authorization": token,
    "content-type": "application/json",
  },
  body: JSON.stringify({ input: "Your prompt here" }),
});
const result = await response.json();
```

### Using Stripe webhooks

The `stripe` package is pre-installed. Use `process.env.STRIPE_SECRET_KEY` and `process.env.STRIPE_WEBHOOK_SECRET` from Settings > Advanced secrets.

### Reading workspace files from API routes

```typescript
const file = Bun.file("/home/workspace/path/to/file.json");
const content = await file.json();
```

### Using static assets

1. Upload from workspace: `update_space_asset("/home/workspace/image.png", "/images/hero.png")`
2. Reference in pages: `<img src="/images/hero.png" />`

Assets are served from `/__substrate/space/assets/` and are always public.

## Gotchas and Limitations

### Build failures break all pages
A syntax error in any page route will cause the Vite build to fail, breaking ALL pages. API routes are more resilient since they're imported individually. Always check `get_space_errors()` after updating page routes.

### No hot reload
Route updates require a full rebuild + server restart. The server is managed by supervisord as `zo-space`.

### API routes get ALL methods
Handlers are registered with `app.all()`, not method-specific routes. You must check `c.req.method` yourself if you want to restrict methods.

### No shared state between API routes
Each API route file is a standalone module. There's no shared in-memory state between routes (except through file system, databases, or env vars). The server does maintain module-level state within a single route between requests.

### Server crash loop
The zo-space server can enter a crash loop if it fails to start (e.g., port conflict, bad route code). Check `/dev/shm/zo-space.log` and `/dev/shm/zo-space_err.log` for diagnostics. The supervisor will keep trying to restart it.

### Page routes are single-file
Each page route is one TSX file. You can't split a page into multiple component files. Put all components inline in the same file, or fetch shared data from API routes.

### No custom npm packages in routes
You can only use packages already installed in `/__substrate/space/node_modules/`. You cannot add new npm dependencies via route code. Work with what's available or implement logic inline.

### `import.meta.env.VITE_HANDLE` in pages
To get the user's handle in page routes, use `import.meta.env.VITE_HANDLE`.

### `process.env` only works server-side
Environment variables via `process.env` are only available in API routes, not in page routes. For pages, use `import.meta.env.VITE_*` variables.

### No path aliases in routes
The `@/` alias resolves to `/__substrate/space/src/`. Routes live in `/__substrate/space/routes/`. Importing from `@/components/ui/card` works but it's reaching into the SPA source. Use it for the pre-built shadcn components, but don't rely on it for custom code.

### Error reporting
- Build errors: written to `/__substrate/space/.errors/_build.json`
- Runtime errors: written to `/__substrate/space/.errors/{route}.json`
- Client errors: posted to `/api/_error` by the ErrorBoundary
- All retrievable via `get_space_errors()`

### Proxy logs
Request logs are at `/dev/shm/zosite-3099-proxy.log`. Server logs at `/dev/shm/zo-space.log`.

## Debugging Workflow

1. `get_space_errors()` -- check for build or runtime errors
2. Read `/dev/shm/zo-space.log` for server output
3. Read `/dev/shm/zo-space_err.log` for crash/restart info
4. Read `/dev/shm/zosite-3099-proxy.log` for HTTP request logs
5. If server is in crash loop, check error logs and fix the offending route
6. After fixing, the supervisor will automatically restart the server
