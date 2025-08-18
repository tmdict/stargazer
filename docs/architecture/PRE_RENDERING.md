# SSG Pre-Rendering

## Overview

The pre-rendering system uses vite-ssg to generate static HTML for content pages while preserving the dynamic game experience. It selectively pre-renders only documentation and skill pages, leaving the interactive game as a client-side application.

## Design Principles

1. **Selective Pre-rendering**: Only content pages are pre-rendered, not the interactive game
2. **Prop-based Static Content**: Pass data as props to components in static pages to avoid hydration mismatches
3. **Route-based Locale**: Determine language from URL path rather than global state during SSG
4. **SSR Safety**: Guard browser APIs with environment checks to prevent build errors
5. **Shared Routes**: Single route definition used by both SPA and SSG modes
6. **Minimal Store Dependencies**: Static pages avoid store dependencies, using hardcoded strings and props instead

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

Simplified configuration without i18n store dependency:

```typescript
export const createApp = ViteSSG(
  App,
  { routes }, // Shared routes from router/routes.ts
  async ({ app }) => {
    const pinia = createPinia()
    app.use(pinia)
    // No i18n store setup needed - static pages handle locale themselves
  },
)
```

Key considerations:

- **Shared routes**: Uses same route definitions as SPA
- **No global locale state**: Static pages extract locale from route
- **Minimal setup**: No pre-loading or router guards needed

### Static Content Components

#### PageContainer Component

The PageContainer component does not depend on i18n store for static pages:

```typescript
// PageContainer.vue - simplified without i18n
<template>
  <div class="overlay">
    <a href="/" class="backdrop-link" aria-label="Stargazer"></a>
    <!-- content -->
  </div>
</template>
```

Key considerations:

- Uses hardcoded "Stargazer" instead of translations
- No store dependencies for static rendering
- Clean separation from dynamic app state

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
<!-- src/content/skills/Silvina.en.vue -->
<template>
  <GridSnippet :grid-style="gridStyles.main" :images />
</template>

<script setup lang="ts">
import { gridStyles, images } from './Silvina.data'
</script>
```

Key considerations:

- **Dual mode support**: Components work with both props (SSG) and store (SPA)
- **No hydration mismatch**: Static pages use props, avoiding store state changes
- **Clean separation**: Static content is self-contained with its own data
- **Locale from route**: Static views extract locale from URL path using `useRouteLocale`
- **No i18n dependency**: PageContainer and static views use hardcoded strings

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

### Locale Extraction

#### Route Locale Composable (`/src/composables/useRouteLocale.ts`)

Extract locale from the current route path:

```typescript
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useRouteLocale() {
  const route = useRoute()

  const locale = computed(() => {
    const match = route.path.match(/^\/(en|zh)\//)
    return match ? match[1] : 'en'
  })

  return locale
}
```

Used in static view components:

```typescript
// In About.vue and Skill.vue
import { useRouteLocale } from '@/composables/useRouteLocale'

const locale = useRouteLocale()
const { ContentComponent } = useContentComponent({
  type: 'skill',
  name: normalizedSkillName,
  locale, // Pass extracted locale
})
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
