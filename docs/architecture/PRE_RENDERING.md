# SSG Pre-Rendering

## Overview

The pre-rendering system uses vite-ssg to generate static HTML for the skill permalink pages while preserving the dynamic game experience. Skill pages (`/{en,zh}/skill/<slug>`) are the only pre-rendered content; everything else (home, skills index, wandwars, the about modal) is client-side. The share page is also pre-rendered with default state so direct URLs resolve.

## Design Principles

1. **Selective Pre-rendering**: Only content pages are pre-rendered, not the interactive game
2. **Prop-based Static Content**: Pass data as props to components in static pages to avoid hydration mismatches
3. **Route-based Locale**: Language comes from the URL path; `App.vue` also syncs the global i18n store from the path (`splitLocalePath`) so shared chrome and the skill browser render in the URL's locale
4. **SSR Safety**: Guard browser APIs with environment checks to prevent build errors
5. **Shared Routes**: Single route definition used by both SPA and SSG modes
6. **Selective Store Dependencies**: Most static views avoid heavy store dependencies — the shared header calls `i18n.initialize()` (idempotent) from `App.vue`. The skill permalink pages are the deliberate exception: they render the full character browser and load display data during SSG via `gameDataStore.initializeContentData()` so the grid and its crawlable links pre-render

## How It Works

**Development Mode** (`npm run dev`):

- Always runs as SPA using `index.html` → `main.ts`
- Hot module replacement enabled
- No pre-rendering (for fast development)

**SPA Build** (`npm run build:spa`):

- Traditional client-side bundle
- Uses `index.html` → `main.ts`
- No pre-rendered pages

**SSG Build** (`npm run build:ssg`):

- Pre-renders content pages at build time
- Uses `main.ssg.ts` entry point
- Generates static HTML for content pages
- Home page remains client-only
- Share page is pre-rendered with default state for direct URL access

## Implementation Details

### Route Configuration

Shared routes defined once and used by both modes:

```typescript
// src/router/routes.ts (abbreviated)
export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('@/views/HomeView.vue') },
  { path: '/share', component: () => import('@/views/ShareView.vue') },
  { path: '/skills', component: () => import('@/views/SkillsView.vue') },
  { path: '/wandwars', component: () => import('@/views/WandWarsView.vue') },
  { path: '/en/skill/:name', component: () => import('@/views/SkillView.vue'), props: true },
  // ...zh equivalent
]
```

Key considerations:

- Single source of truth for all routes
- `/`, `/skills`, `/wandwars` are client-only (interactive). `/` is in the SSG list (no static content, but produces a fallback `index.html`); `/skills` and `/wandwars` rely on the host's SPA fallback
- Share route is pre-rendered with default content for direct URL navigation
- Per-skill `/{en,zh}/skill/<slug>` routes are pre-rendered as the canonical skill permalinks
- Locale determined from URL path, not props

### SSG Entry Point (`/src/main.ssg.ts`)

Simplified configuration; i18n bootstrap lives in `App.vue`, not here:

```typescript
export const createApp = ViteSSG(
  App,
  { routes }, // Shared routes from router/routes.ts
  async ({ app }) => {
    app.use(createPinia())
  },
)
```

`App.vue` runs `i18n.initialize()` at setup time. It is idempotent and SSR-safe, and ensures the shared header (rendered on every route, including the SSG-only `/skill/*` pages) resolves translation keys rather than emitting literals like `wandwars.wand-wars`. It also watches the route path and calls `i18n.setLocale()` for any `/{en,zh}/...` route (via `splitLocalePath`), so the store-backed chrome and the skill browser's right column render in the URL's locale during SSG and client navigation alike. Per-page skill content still derives its locale directly from the URL via `useRouteLocale`.

Key considerations:

- **Shared routes**: Uses same route definitions as SPA
- **Per-page locale from route**: Static views extract locale from URL
- **Header i18n in App.vue**: Idempotent init keeps the nav chrome translated on SSG-only routes

### Static Content Components

#### GridSnippet Component

The GridSnippet component supports both dynamic (store-based) and static (prop-based) image loading to avoid hydration mismatches:

```typescript
// GridSnippet.vue
interface Props {
  gridStyle: GridStyleConfig
  width?: number
  height?: number
  hexSize?: number
  images?: Record<string, string> // Optional images prop for SSG
}

const getCharacterImage = (characterName: string): string | undefined => {
  // First check if images were passed as props (for SSG/static content)
  if (props.images && props.images[characterName]) {
    return props.images[characterName]
  }
  // Fall back to store for dynamic content
  return gameDataStore.characterImages[characterName]
}
```

#### Content Components

Content components are self-contained with their own data and locale handling:

```vue
<!-- src/content/skill/Silvina.en.vue -->
<template>
  <GridSnippet :grid-style="gridStyles.main" :images />
</template>

<script setup lang="ts">
import { gridStyles, images } from './Silvina.data'
</script>
```

Data files use optimized images via vite-imagetools:

```typescript
// src/content/skill/Silvina.data.ts
import silvinaImage from '@/assets/images/character/silvina.png?format=webp&quality=80&w=100'

export const gridStyles = {
  /* ... */
}
export const images = {
  silvina: silvinaImage,
}
```

Key considerations:

- **Dual mode support**: Components work with both props (SSG) and store (SPA)
- **No hydration mismatch**: Static pages use props, avoiding store state changes
- **Clean separation**: Static content is self-contained with its own data
- **Locale from route**: Static views extract locale from URL path using `useRouteLocale`
- **Header i18n via App.vue**: The shared nav uses store-backed translations; static view bodies still avoid store dependencies
- **Optimized images**: Content data files use vite-imagetools for WebP conversion

### SSR-Safe Stores

#### Game Data Store (`/src/stores/gameData.ts`)

```typescript
// Interactive game (home/share): client-only, stays empty during SSG.
const initializeData = () => {
  if (dataLoaded.value || import.meta.env.SSR) {
    return // Skip during SSG
  }
  loadIntoState()
}

// Content pages (skill browser): SSR-safe, so the grid + crawlable links
// pre-render. Same data, no SSR guard. Idempotent via dataLoaded.
const initializeContentData = () => {
  if (dataLoaded.value) return
  loadIntoState()
}
```

Key considerations:

- **Two loaders, one body**: `initializeData` keeps the interactive game client-only; `initializeContentData` opts the skill browser into SSG without disturbing home/share
- **No hydration mismatch**: `initializeContentData` runs synchronously in `SkillsBrowser` setup, so the client's first render matches the pre-rendered HTML (same deterministic data-loader output)
- **Preserved functionality**: Home and share pages are unchanged

### Locale Extraction

#### Locale-prefix parser (`/src/utils/routeLocale.ts`)

A single pure helper splits a path into its locale prefix and remainder; the route-locale composable, the `App.vue` store sync, and the language toggle all share it so the prefix regex lives in one place:

```typescript
export function splitLocalePath(path: string): { locale: Locale | null; rest: string } {
  const match = path.match(/^\/(en|zh)(\/.*)?$/)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as Locale, rest: match[2] ?? '' }
}
```

`useRouteLocale()` wraps it for static views that need the page locale (defaulting to `'en'`):

```typescript
// In SkillView.vue
const lang = useRouteLocale() // computed(() => splitLocalePath(route.path).locale ?? 'en')
```

#### i18n Store (`/src/stores/i18n.ts`)

```typescript
const setLocale = (locale: Locale) => {
  currentLocale.value = locale

  // Skip browser APIs during SSR
  if (!import.meta.env.SSR) {
    document.documentElement.lang = locale
    localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  }
}
```

Key considerations:

- **Unified method**: Single setLocale works for both SSG and SPA
- **SSR-safe**: Automatically detects environment and skips browser APIs
- **No special SSG methods**: Cleaner API surface

### Build Configuration

Vite config includes SSG-specific options:

```typescript
ssgOptions: {
  entry: 'src/main.ssg.ts',
  includedRoutes: () => [
    '/', '/share', // Share page for direct URL access
    '/en/skill/silvina', '/zh/skill/silvina', // ... all skill pages, both locales
  ],
  onPageRendered: (route, html) => {
    // Inject correct lang attribute
    const locale = route.match(/^\/(en|zh)\//)?.[1]
    return html.replace(/<html[^>]*>/, `<html lang="${locale}">`)
  }
}
```

`onPageRendered` also extracts the page description from the first `<article>` element in the rendered HTML (regex `/<article[^>]*>([\s\S]*?)<\/article>/`). Skill page bodies (`SkillSections.vue`) wrap themselves in `<article>` so this contract holds — changing the root tag would silently break per-page descriptions.

### `@unhead/vue` Version Pinning

`@unhead/vue` is pinned to `^2.1.4` in `package.json` to match the version bundled inside `vite-ssg@28.3.0` (v2.1.15). Allowing the root to install v3.x produces two parallel head instances during SSG — same-key inject still works, but cross-version `push` does not reliably populate the v2 head, so `<title>`, canonical, and keywords drop out of the rendered HTML. If `vite-ssg` later bumps to unhead v3, lift this pin in the same change.

### TypeScript Support for Imagetools

TypeScript declarations for vite-imagetools queries are defined in `env.d.ts`:

```typescript
// env.d.ts
declare module '*.png?format=webp&quality=80&w=100' {
  const src: string
  export default src
}
```

This allows content data files to import optimized images with proper type support.

### Share Page Handling

The Share page (`/share`) is a special case in the SSG build:

- **Pre-rendered with default state**: Generates a share.html file with empty/default content
- **Direct URL support**: Allows users to navigate directly to `site.com/share?g=...` without 404 errors
- **Client-side hydration**: Once loaded, JavaScript parses the query parameter and displays the shared grid state
- **Same behavior as home page**: After hydration, works identically to the home page for grid visualization

This approach ensures that shared links work reliably even when accessed directly, while maintaining the interactive nature of the grid visualization.

### Browser API Protection

Components check for SSR environment:

```typescript
// In useDragDrop.ts
let transparentDragImage: HTMLImageElement | null = null
if (!import.meta.env.SSR && typeof Image !== 'undefined') {
  transparentDragImage = new Image()
  transparentDragImage.src = 'data:image/gif;base64...'
}
```
