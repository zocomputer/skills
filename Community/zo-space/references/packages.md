# Available Packages in zo.space

All packages below are pre-installed in `/__substrate/space/node_modules/`.
You CANNOT install additional packages. Work with what's here.

## Server-Side (API Routes)

These can be imported in API route files:

### Hono (^4.10.x)
```typescript
import type { Context } from "hono";
// Context methods:
// c.req.url, c.req.method, c.req.header("name"), c.req.query("key")
// c.req.json(), c.req.text(), c.req.formData()
// c.json(data, status?), c.text(str), c.html(str), c.redirect(url)
// c.notFound(), c.body(stream)
```

### Stripe (^17.7.x)
```typescript
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
```

### Marked (^17.0.x)
```typescript
import { marked } from "marked";
const html = marked("# Hello");
```

### Zod (^4.1.x)
```typescript
import { z } from "zod";
const schema = z.object({ name: z.string() });
```

### Bun Built-ins
```typescript
// File I/O
const file = Bun.file("/path/to/file");
const text = await file.text();
const json = await file.json();
const exists = await file.exists();
await Bun.write("/path/to/file", "content");

// Spawn processes
const proc = Bun.spawn(["command", "arg1"], {
  stdout: "pipe",
  stderr: "pipe",
  cwd: "/path",
});
const output = await new Response(proc.stdout).text();
await proc.exited;

// fetch() is global
const res = await fetch("https://api.example.com/data");
```

### Node.js Built-ins
```typescript
import { readdir, unlink, mkdir } from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";
```

## Client-Side (Page Routes)

### React (^19.2.x)
```tsx
import { useState, useEffect, useRef, useCallback, useMemo, useContext, createContext } from "react";
import { lazy, Suspense } from "react";
```

### React Router DOM (^7.9.x)
```tsx
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
// Note: BrowserRouter is already set up in App.tsx. Don't create another.
```

### Lucide React (^0.562.x)
```tsx
import { Globe, Send, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
// All icons: https://lucide.dev/icons/
// Usage: <Globe className="w-5 h-5 text-primary" />
```

### Tabler Icons React (^3.35.x)
```tsx
import { IconWorld, IconAlertTriangle, IconCheck } from "@tabler/icons-react";
// Usage: <IconWorld className="size-5" />
```

### Recharts (^3.6.x)
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
```

### TanStack React Table (^8.21.x)
```tsx
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
```

### DnD Kit
```tsx
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

### Sonner (^2.0.x) -- Toast Notifications
```tsx
import { toast, Toaster } from "sonner";
// Add <Toaster /> to your component
// Then: toast("Hello!"), toast.success("Done"), toast.error("Failed")
```

### Vaul (^1.1.x) -- Drawer
```tsx
import { Drawer } from "vaul";
```

### Reveal.js (^5.2.x) -- Presentations
```tsx
import Reveal from "reveal.js";
```

### Class Utilities
```tsx
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
// Or use the pre-built cn() from @/lib/utils:
// import { cn } from "@/lib/utils";
```

### CVA -- Class Variance Authority
```tsx
import { cva, type VariantProps } from "class-variance-authority";
const buttonVariants = cva("px-4 py-2 rounded", {
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground",
      destructive: "bg-destructive text-white",
    },
  },
  defaultVariants: { variant: "default" },
});
```

### Radix UI Primitives
```tsx
// Available primitives (import from @radix-ui/react-*):
import * as Avatar from "@radix-ui/react-avatar";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Label from "@radix-ui/react-label";
import * as Select from "@radix-ui/react-select";
import * as Separator from "@radix-ui/react-separator";
import * as Slot from "@radix-ui/react-slot";
import * as Tabs from "@radix-ui/react-tabs";
import * as Toggle from "@radix-ui/react-toggle";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import * as Tooltip from "@radix-ui/react-tooltip";
```

### Pre-built shadcn Components
Only two are pre-built and available via `@/components/ui/`:
- `Card` (`@/components/ui/card`) -- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- `Chart` (`@/components/ui/chart`) -- ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent (wraps Recharts)

For other UI patterns, either use Radix primitives directly or build inline.

### next-themes
```tsx
// ThemeProvider is already wrapping the app.
// To read/set theme in a page:
import { useTheme } from "@/components/theme-provider";
const { theme, setTheme } = useTheme();
// theme: "light" | "dark" | "system"
```

### @tailwindcss/typography
```tsx
// For rendering rich text/markdown:
<article className="prose dark:prose-invert max-w-none">
  <div dangerouslySetInnerHTML={{ __html: renderedMarkdown }} />
</article>
```
