# zo.space Route Examples

## Simple API Route (GET only)

```typescript
import type { Context } from "hono";
export default (c: Context) => c.json({ status: "ok", time: new Date().toISOString() });
```

## API Route with Method Handling

```typescript
import type { Context } from "hono";

interface Item { id: string; name: string; }
const items: Item[] = [];

export default async (c: Context) => {
  if (c.req.method === "GET") {
    return c.json({ items });
  }

  if (c.req.method === "POST") {
    const body = await c.req.json();
    const item: Item = { id: crypto.randomUUID(), name: body.name };
    items.push(item);
    return c.json(item, 201);
  }

  if (c.req.method === "DELETE") {
    const url = new URL(c.req.url);
    const id = url.searchParams.get("id");
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return c.json({ error: "Not found" }, 404);
    items.splice(idx, 1);
    return c.json({ deleted: true });
  }

  return c.json({ error: "Method not allowed" }, 405);
};
```

Note: In-memory state (like `items` above) persists between requests but is lost on server restart.

## API Route Querying DuckDB

```typescript
import type { Context } from "hono";

async function query(db: string, sql: string): Promise<any[]> {
  const proc = Bun.spawn(["duckdb", db, "-json", "-c", sql], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error(stderr);
  return JSON.parse(stdout || "[]");
}

export default async (c: Context) => {
  try {
    const url = new URL(c.req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const rows = await query(
      "/home/workspace/Data/mydata.db",
      `SELECT * FROM my_table ORDER BY created_at DESC LIMIT ${limit}`
    );
    return c.json({ data: rows });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
};
```

## API Route Reading Workspace Files

```typescript
import type { Context } from "hono";

export default async (c: Context) => {
  try {
    const file = Bun.file("/home/workspace/Data/config.json");
    if (!(await file.exists())) {
      return c.json({ error: "File not found" }, 404);
    }
    const data = await file.json();
    return c.json(data);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
};
```

## API Route Calling Zo API

```typescript
import type { Context } from "hono";

export default async (c: Context) => {
  if (c.req.method !== "POST") return c.json({ error: "POST required" }, 405);

  const { message } = await c.req.json();
  const token = process.env.ZO_CLIENT_IDENTITY_TOKEN;
  if (!token) return c.json({ error: "Token not configured" }, 500);

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      "authorization": token,
      "content-type": "application/json",
    },
    body: JSON.stringify({ input: message }),
  });

  const result = await res.json() as any;
  return c.json({ response: result.output || "No response" });
};
```

## Simple Page Route

```tsx
export default function About() {
  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">About</h1>
        <p className="text-muted-foreground">This is a simple page.</p>
      </div>
    </div>
  );
}
```

## Page Route with Data Fetching

```tsx
import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface Task {
  id: number;
  title: string;
  status: string;
  priority: string;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(() => {
    setLoading(true);
    fetch("/api/tasks?filter=active")
      .then(r => r.json())
      .then(data => {
        setTasks(data.tasks || []);
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tasks</h1>
          <button onClick={fetchTasks} className="p-2 rounded-lg hover:bg-muted">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        <div className="space-y-2">
          {tasks.map(task => (
            <div key={task.id} className="p-4 rounded-lg border bg-card">
              <div className="font-medium">{task.title}</div>
              <div className="text-sm text-muted-foreground mt-1">{task.status} / {task.priority}</div>
            </div>
          ))}
          {tasks.length === 0 && (
            <p className="text-muted-foreground text-center py-8">No tasks found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Page Route with Dark Mode Toggle

```tsx
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon } from "lucide-react";

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="flex items-center gap-4">
        <span className="text-sm">Theme:</span>
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-2 rounded-lg border hover:bg-muted"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
```

## Page Route with Charts (Recharts)

```tsx
import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function Analytics() {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/analytics")
      .then(r => r.json())
      .then(d => setData(d.points || []))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <h1 className="text-2xl font-bold mb-6">Analytics</h1>
      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" className="text-muted-foreground" />
            <YAxis className="text-muted-foreground" />
            <Tooltip />
            <Line type="monotone" dataKey="value" className="stroke-primary" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

## Stripe Webhook Handler

```typescript
import type { Context } from "hono";
import Stripe from "stripe";

const processedEvents = new Map<string, number>();
const TTL = 24 * 60 * 60 * 1000;

function markProcessed(id: string) {
  processedEvents.set(id, Date.now());
  for (const [key, ts] of processedEvents) {
    if (Date.now() - ts > TTL) processedEvents.delete(key);
  }
}

export default async (c: Context) => {
  const sig = c.req.header("stripe-signature");
  const body = await c.req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const key = process.env.STRIPE_SECRET_KEY;

  if (!sig || !secret) return c.json({ error: "Missing signature or secret" }, 400);

  let event: Stripe.Event;
  try {
    const stripe = new Stripe(key || "");
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err) {
    return c.json({ error: "Invalid signature" }, 400);
  }

  if (processedEvents.has(event.id)) {
    return c.json({ received: true, skipped: "duplicate" });
  }
  markProcessed(event.id);

  switch (event.type) {
    case "checkout.session.completed":
      console.log("Checkout completed:", event.data.object.id);
      break;
  }

  return c.json({ received: true });
};
```
