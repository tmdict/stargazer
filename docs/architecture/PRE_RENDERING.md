# SSG Pre-Rendering

## Overview

The pre-rendering system uses vite-ssg to generate static HTML for content pages while preserving the dynamic game experience. It selectively pre-renders only documentation and skill pages, leaving the interactive game as a client-side application.

## Design Principles

1. **Selective Pre-rendering**: Only content pages are pre-rendered, not the interactive game
2. **Minimal State Hydration**: Pre-load only essential data (character images) for content pages
3. **Route-based Locale**: Determine language from URL path rather than global state during SSG
4. **SSR Safety**: Guard browser APIs with environment checks to prevent build errors
5. **Shared Routes**: Single route definition used by both SPA and SSG modes

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

## Implementation Details

### Route Configuration

Shared routes defined once and used by both modes:

```typescript
// src/router/routes.ts
export const routes: RouteRecordRaw[] = [
  { path: '/', component: () => import('../views/Home.vue') },
  { path: '/en/about', component: () => import('../views/About.vue') },
  { path: '/zh/about', component: () => import('../views/About.vue') },
  { path: '/en/skill/:name', component: () => import('../views/Skill.vue'), props: true },
  { path: '/zh/skill/:name', component: () => import('../views/Skill.vue'), props: true },
]
```

Key considerations:

- Single source of truth for all routes
- Home route included but not pre-rendered during SSG
- Locale determined from URL path, not props

### SSG Entry Point (`/src/main.ssg.ts`)

Configures vite-ssg with router guard for locale and minimal data loading:

```typescript
export const createApp = ViteSSG(
  App,
  { routes }, // Shared routes from router/routes.ts
  async ({ app, router, initialState }) => {
    const pinia = createPinia()
    app.use(pinia)

    if (import.meta.env.SSR) {
      // Set locale from URL during pre-rendering
      router.beforeEach((to) => {
        const match = to.path.match(/^\/(en|zh)\//)
        if (match) {
          const i18n = useI18nStore(pinia)
          i18n.setLocale(match[1] as 'en' | 'zh')
        }
      })

      // Pre-load character images for GridSnippet
      const characterImages = loadCharacterImages()
      initialState.gameData = { characterImages }
    }
  },
)
```

Key considerations:

- **Shared routes**: Uses same route definitions as SPA
- **Router guard**: Sets locale based on URL path during SSG
- **Minimal data**: Only loads character images for content pages

### Data Loader (`/src/utils/dataLoader.ts`)

Provides focused loading functions for SSG:

```typescript
export function loadCharacterImages(): Record<string, string> {
  const modules = import.meta.glob('/src/assets/characters/*.webp', {
    eager: true,
    import: 'default',
  })
  // Map to { name: url } dictionary
}
```

Key considerations:

- **Isolated loading**: Load only what's needed for content pages
- **Synchronous**: Uses eager imports for SSG compatibility
- **Type-safe**: Returns typed data structures

### SSR-Safe Stores

#### Game Data Store (`/src/stores/gameData.ts`)

```typescript
const initializeData = () => {
  if (dataLoaded.value || import.meta.env.SSR) {
    return // Skip during SSG
  }
  // Normal initialization
}

const setCharacterImages = (images: Record<string, string>) => {
  characterImages.value = images
}
```

Key considerations:

- **SSR guard**: Skip initialization during pre-rendering
- **Direct setters**: Allow SSG to inject pre-loaded data
- **Preserved functionality**: Client-side behavior unchanged

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
    '/', '/en/about', '/zh/about',
    '/en/skill/silvina', // ... all skill pages
  ],
  onPageRendered: (route, html) => {
    // Inject correct lang attribute
    const locale = route.match(/^\/(en|zh)\//)?.[1]
    return html.replace(/<html[^>]*>/, `<html lang="${locale}">`)
  }
}
```

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
