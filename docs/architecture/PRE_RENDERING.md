# SSG Pre-Rendering

## Overview

The pre-rendering system uses vite-ssg to emit static HTML at build time while preserving the dynamic game experience. Pre-rendered routes are the per-hero skill permalinks (`/<lang>/skill/<slug>`, one page per language in `SKILL_LOCALES`, 16 today, ~1.9k pages) and guide pages (`/{en,zh}/guide`) for crawlable content, plus `/`, `/share`, `/skills`, and `/wandwars`. The latter three carry little/no static body, they exist in the SSG list so each ships the correct canonical/meta and resolves on direct navigation; `/skills` additionally pre-renders its browser content. Every route still hydrates into the full SPA after load.

## Design Principles

1. **Selective Pre-rendering**: Content/permalink pages pre-render their bodies; interactive routes in the SSG list (`/`, `/skills`, `/wandwars`) emit only a canonical/meta shell, never game state
2. **Prop-based Static Content**: Pass data as props to components in static pages to avoid hydration mismatches
3. **Route-based Locale, two axes**: The skill-page prefix is the _skill-text_ language (`SkillLocale`, any of 16); the site chrome (`AppLocale`) stays en/zh. `App.vue` syncs the i18n store from the path via `splitLocalePath`, whose regex is deliberately `(en|zh)`: an exotic prefix like `/ko/…` parses as "unprefixed", so chrome falls back to the saved preference (default en) and the header toggle flips chrome without rewriting the content URL
4. **SSR Safety**: Guard browser APIs with environment checks to prevent build errors
5. **Shared Routes**: Single route definition used by both SPA and SSG modes
6. **Selective Store Dependencies**: Most static views avoid heavy store dependencies; the shared header calls `i18n.initialize()` (idempotent) from `App.vue`. The skill permalink pages are the deliberate exception: they render the full character browser and load display data during SSG via `gameDataStore.initializeContentData()` so the grid and its crawlable links pre-render

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
  {
    // One route across all 16 text locales; the param regex is built from
    // SKILL_LOCALES so garbage prefixes fall to the not-found redirect.
    path: `/:textLocale(${SKILL_LOCALE_PATTERN})/skill/:name`,
    component: () => import('@/views/SkillView.vue'),
    props: true,
    // locale chunk warm-up: warmSkillLocale, a global beforeResolve (below)
  },
  // /en/guide, /zh/guide stay explicit (guide content is en/zh only)
]
```

Key considerations:

- Single source of truth for all routes
- `/`, `/skills`, `/wandwars` are interactive but still in the SSG list so each emits its own static HTML (`index.html` / `skills.html` / `wandwars.html`) carrying the right canonical/meta; `/` and `/wandwars` are otherwise empty shells, `/skills` pre-renders its browser content. All three hydrate to the full app
- Share route is pre-rendered with default content for direct URL navigation
- Per-skill `/<lang>/skill/<slug>` routes are pre-rendered as the canonical skill permalinks, one per language in `SKILL_LOCALES`
- Text locale comes from the `:textLocale` route param (`props: true`); chrome locale from the store

### Skill-locale chunks and the warm-up guard

en/zh skill text is eagerly bundled (the search index, guide panels, and the en fallback read it synchronously). Every other language ships as **one lazy chunk per locale**: the importer emits an `index.ts` per locale dir whose eager same-dir glob inlines that dir's JSON, and `loadSkillLocale(lang)` dynamically imports it (promise-cached).

vite-ssg renders each route exactly once, synchronously; nothing async-rendered lands in the baked HTML (no `<Suspense>` in the app). Skill routes therefore run `warmSkillLocale` (exported from `routes.ts`), an async guard that awaits `loadSkillLocale(textLocale)`: vite-ssg's per-route render awaits router navigation, so the baked page contains real text and `extractContentDescription` scrapes the right language. Client navigation shares the same warm-up, so `SkillSections` stays a synchronous component. The guard is registered as a **global `beforeResolve`** in both entries (`router/index.ts` and `main.ssg.ts`) rather than `beforeEnter` on the route record: `beforeEnter` skips param-only navigation, and the globe menu's locale switch is exactly that (same record, new `:textLocale`). On a chunk fetch failure (offline, or a stale tab importing a re-hashed chunk after a deploy) the guard falls back to a hard navigation to the target URL; if that too cannot load, the reader renders the en fallback.

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

`App.vue` runs `i18n.initialize()` at setup time. It is idempotent and SSR-safe, and ensures the shared header (rendered on every route, including the SSG-only `/skill/*` pages) resolves translation keys rather than emitting literals like `wandwars.wand-wars`. It also watches the route path and calls `i18n.setLocale()` for any `/{en,zh}/...` route (via `splitLocalePath`), so the store-backed chrome renders in the URL's locale during SSG and client navigation alike. Non-en/zh skill prefixes (`/ko/…`) intentionally parse as unprefixed: the watcher no-ops, SSG bakes those pages with en chrome, and the saved chrome preference applies post-mount exactly like the unprefixed shells. Skill content derives its text locale from the `:textLocale` route param.

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

A single pure helper splits a path into its app-locale prefix and remainder; the route-locale composable, the `App.vue` store sync, and the language toggle all share it so the prefix regex lives in one place. The regex stays `(en|zh)` by design; it is the _app-locale_ classifier, and skill-text prefixes outside that set must parse as unprefixed (see the invariant comment in the file):

```typescript
export function splitLocalePath(path: string): { locale: AppLocale | null; rest: string } {
  const match = path.match(/^\/(en|zh)(\/.*)?$/)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as AppLocale, rest: match[2] ?? '' }
}
```

`useRouteLocale()` wraps it for views pinned to app locales (the guide); `SkillView` reads its text locale from the `:textLocale` route param instead:

```typescript
// In GuideView.vue
const lang = useRouteLocale() // computed(() => splitLocalePath(route.path).locale ?? 'en')

// In SkillView.vue (route has props: true)
const props = defineProps<{ name?: string; textLocale?: string }>()
```

#### i18n Store (`/src/stores/i18n.ts`)

```typescript
const applyDocumentLang = () => {
  if (import.meta.env.SSR) return
  // On skill routes the content locale owns <html lang> via htmlLangOverride
  // (set by setupSkillContentMeta with owner-token clearing); chrome flips
  // cannot stomp it because every document-lang write funnels through here.
  document.documentElement.lang = htmlLangOverride.value ?? currentLocale.value
}
```

Chrome regions that stay in the app locale under a content-locale `<html lang>` carry their own `lang` attribute (the App header, the roster column, the locale hint): screen readers and the browser's per-language font fallback follow the nearest `lang`, so without it a `lang="ko"` page renders the chrome's CJK glyphs with Korean font fallback.

The store also holds `skillLocale` (`stargazer.skillLocale`): the saved skill-text preference, written only by explicit globe picks and validated against `SKILL_LOCALES` on read. `effectiveSkillLocale` (saved pref, else app locale) feeds link prefixes on surfaces with no content context (`/skills` roster tiles, guide panel links, modal seeding). Skill pages themselves always read the URL prefix.

Key considerations:

- **SSR-safe**: Automatically detects environment and skips browser APIs
- **Post-mount preference reads**: `initializeLocale` / `initializeSkillLocale` run after mount so baked HTML hydrates unchanged before saved preferences swap text and hrefs

### Build Configuration

Vite config includes SSG-specific options:

```typescript
ssgOptions: {
  entry: 'src/main.ssg.ts',
  includedRoutes: () => [
    '/', '/share', '/skills', '/wandwars', // shells for canonical/meta + direct access
    '/en/guide', '/zh/guide',
    // every (language, hero) file under src/locales/skill/<code>/:
    // 16 locales × ~117 heroes; the filesystem is the source of truth
    '/en/skill/silvina', '/ko/skill/silvina', /* ... */
  ],
  onPageRendered: (route, html) => {
    // Inject correct lang attribute (pattern built from SKILL_LOCALES)
    const locale = route.match(LOCALE_PREFIX_RE)?.[1]
    return html.replace(/<html[^>]*>/, `<html lang="${locale}">`)
  }
}
```

`onPageRendered` also extracts the page description from the first `<article>` element in the rendered HTML (regex `/<article[^>]*>([\s\S]*?)<\/article>/`). Skill page bodies (`SkillSections.vue`) wrap themselves in `<article>` so this contract holds; changing the root tag would silently break per-page descriptions.

### `@unhead/vue` Version Pinning

`@unhead/vue` is pinned to `^2.1.4` in `package.json` to match the version bundled inside `vite-ssg@28.3.0` (v2.1.15). Allowing the root to install v3.x produces two parallel head instances during SSG; same-key inject still works, but cross-version `push` does not reliably populate the v2 head, so `<title>`, canonical, and keywords drop out of the rendered HTML. If `vite-ssg` later bumps to unhead v3, lift this pin in the same change.

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
