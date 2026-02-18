# Styling Reference for zo.space

## Tailwind CSS 4

zo.space uses Tailwind CSS 4 with the `@tailwindcss/vite` plugin. Configuration is CSS-first (not `tailwind.config.ts`).

The theme is defined in `/__substrate/space/src/styles.css` using CSS custom properties and `@theme inline`.

## Semantic Color Tokens

Always use semantic tokens instead of raw colors. These automatically adapt to light/dark mode.

### Surfaces
| Class | Purpose |
|-------|---------|
| `bg-background` | Main page background |
| `bg-card` | Card/panel surfaces |
| `bg-popover` | Popover/dropdown backgrounds |
| `bg-muted` | Subdued backgrounds (tags, badges) |
| `bg-accent` | Accent backgrounds (hover states) |
| `bg-primary` | Primary action backgrounds (buttons) |
| `bg-secondary` | Secondary action backgrounds |
| `bg-destructive` | Destructive/error actions |
| `bg-input` | Input field backgrounds |
| `bg-sidebar` | Sidebar background |

### Text
| Class | Purpose |
|-------|---------|
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary/subdued text |
| `text-card-foreground` | Text on cards |
| `text-primary-foreground` | Text on primary backgrounds |
| `text-secondary-foreground` | Text on secondary backgrounds |
| `text-accent-foreground` | Text on accent backgrounds |
| `text-popover-foreground` | Text in popovers |
| `text-destructive` | Error/destructive text |

### Borders and Rings
| Class | Purpose |
|-------|---------|
| `border-border` | Standard borders |
| `ring-ring` | Focus rings |
| `border-input` | Input borders |
| `border-sidebar-border` | Sidebar borders |

### Charts
| Class | Purpose |
|-------|---------|
| `text-chart-1` through `text-chart-5` | Chart data series colors |

## Dark Mode

Dark mode is class-based. The `ThemeProvider` adds/removes the `.dark` class on `<html>`.

All semantic tokens have dark variants defined in the `:root` and `.dark` blocks in styles.css.

To write dark-mode-aware styles manually:
```tsx
<div className="bg-white dark:bg-zinc-900">
```

But prefer semantic tokens which handle this automatically.

## Border Radius

Uses the `--radius` CSS variable (0.625rem = 10px):
- `rounded-sm` = `calc(var(--radius) - 4px)` = 6px
- `rounded-md` = `calc(var(--radius) - 2px)` = 8px
- `rounded-lg` = `var(--radius)` = 10px
- `rounded-xl` = `calc(var(--radius) + 4px)` = 14px

## Animations

`tw-animate-css` is imported, providing animation utilities. Standard Tailwind animation classes work:
- `animate-spin`
- `animate-pulse`
- `animate-bounce`
- `animate-ping`

## Typography Plugin

`@tailwindcss/typography` is available. Use the `prose` class for rendered text:

```tsx
<article className="prose dark:prose-invert max-w-none">
  <h1>Title</h1>
  <p>Paragraph with <strong>bold</strong> and <em>italic</em>.</p>
</article>
```

## Color System

The theme uses OKLCH color space (not HSL). Don't try to override with HSL values.

Light mode palette is warm neutral (slightly warm grays).
Dark mode palette is also warm neutral with appropriate contrast.

## Common Patterns

### Full-page layout
```tsx
<div className="min-h-screen bg-background text-foreground">
  <div className="max-w-4xl mx-auto px-6 py-8">
    {/* content */}
  </div>
</div>
```

### Card
```tsx
<div className="rounded-lg border bg-card text-card-foreground p-6 shadow-sm">
  <h3 className="font-semibold">Title</h3>
  <p className="text-sm text-muted-foreground mt-1">Description</p>
</div>
```

### Button (primary)
```tsx
<button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
  Click me
</button>
```

### Button (secondary)
```tsx
<button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors">
  Secondary
</button>
```

### Input
```tsx
<input className="w-full px-3 py-2 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
```

### Badge
```tsx
<span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-medium">
  Badge
</span>
```

### Loading spinner
```tsx
import { Loader2 } from "lucide-react";
<Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
```

### Error banner
```tsx
<div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
  Something went wrong.
</div>
```

### Empty state
```tsx
<div className="text-center py-12">
  <p className="text-muted-foreground">Nothing here yet.</p>
</div>
```
