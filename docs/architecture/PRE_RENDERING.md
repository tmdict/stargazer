# SSG Pre-Rendering

## Overview

The pre-rendering system uses vite-ssg to emit static HTML for every crawlable page at build time while the same bundle hydrates into the full SPA on load. Pre-rendered routes are the per-hero skill permalinks (`/<code>/skill/<slug>`, one page per language in `SKILL_LOCALES`), the en/zh guide pages, and the `/`, `/share`, and `/skills` shells, which sit in the SSG list so each ships its own canonical and meta tags and resolves on direct navigation. Game state never enters the baked HTML: interactive views load their data client-side only.

## Design Principles

1. **Selective Pre-rendering**: Content pages bake their bodies; interactive shells (`/`, `/share`) bake chrome and meta only, and `/teams` is client-only
2. **One Route Table**: `routes`, `scrollBehavior`, and `installRouterGuards` in `routes.ts` serve both entries, so the guard set cannot drift between SPA and SSG
3. **Two Locale Axes**: The skill-text locale is the URL prefix (`SkillLocale`, 16 languages); the chrome locale (`AppLocale`) stays en/zh and is parsed separately, so a `/ko/...` prefix reads as unprefixed chrome
4. **Deterministic Static Input**: Pre-rendered views read synchronous loaders or the SSG-safe store loader, and the one async input (a lazy locale chunk) is awaited by a route guard before render, so the baked HTML equals the client's first render
5. **Post-mount Preferences**: Saved locale preferences apply after mount, so hydration matches the baked English-chrome HTML before text and hrefs swap

## Architecture

```
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│ vite.config.ts       │───▶│ main.ssg.ts          │───▶│ processRenderedPage  │
│ getSSGRoutes():      │    │ ViteSSG(App, routes) │    │ <html lang>, meta    │
│ shells + guide +     │    │ installRouterGuards  │    │ description, chunk   │
│ skill locale dirs    │    │ (warmSkillLocale)    │    │ preload, sitemap     │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
```

## Build Modes

| Command             | What runs                                               |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Vite dev server, `index.html` → `src/main.ts`, SPA only |
| `npm run build`     | `type-check` and `build:ssg` in parallel                |
| `npm run build:ssg` | `vite-ssg build` with `src/main.ssg.ts` as entry        |
| `npm run build:spa` | `type-check` then `vite build`, no pre-rendered pages   |

## Core Components

### Route List (`/vite.config.ts`)

`getSSGRoutes` is the `includedRoutes` source; the filesystem, not a hand-kept list, decides which skill pages exist:

| Route                   | Baked body                                                                       | Output                     |
| ----------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| `/`                     | Chrome and an empty grid (`initializeData` is SSR-skipped)                       | `index.html`               |
| `/share`                | Chrome only; the grid decodes `?g=` after hydration                              | `share.html`               |
| `/skills`               | Roster grid with a link per hero                                                 | `skills.html`              |
| `/{en,zh}/guide`        | Upgrade matrix and tag sections with roster grids; a hero panel mounts on expand | `<code>/guide.html`        |
| `/<code>/skill/<slug>`  | Skill text, hero name, roster grid: 16 locales × 125 heroes = 2,000 pages        | `<code>/skill/<slug>.html` |
| `/teams`, unknown paths | Not pre-rendered; served by the hosting fallback (see Hosting)                   | none                       |

- **Skill routes from locale dirs**: every non-underscore `.json` under `src/locales/skill/<code>/` becomes a page (`_keywords` and `_charms` are per-language data, not heroes). A missing locale dir throws with a pointer to `npm run import:skills`: `SKILL_LOCALES` also drives the globe menu and `hreflang`, so a silent skip would ship links to pages that do not exist
- **Guide routes from `APP_LOCALES`**: guide content is hand-written in en/zh, so the route records stay explicit
- **Shell heads**: `/share` and `/skills` set their own title and canonical through `useHead`; `/` keeps the `index.html` defaults
- **Sitemap**: `onFinished` runs `vite-ssg-sitemap` over `dist/` (2,004 URLs; `/share` and `/forms` excluded) and writes `robots.txt`

### Entries and Guards (`/src/main.ssg.ts`, `/src/router/routes.ts`)

```typescript
export const createApp = ViteSSG(App, { routes, scrollBehavior }, async ({ app, router }) => {
  app.use(createPinia())
  app.directive('scroll-chain', vScrollChain)
  installRouterGuards(router)
})
```

- **Head instances**: vite-ssg creates its own unhead instance (server and client); `main.ts` creates one from `@unhead/vue/client`. i18n bootstrap lives in `App.vue`, not the entries
- **`warmSkillLocale`** (global `beforeResolve`, installed by `installRouterGuards`): awaits `loadSkillLocale(to.params.textLocale)` on skill routes. vite-ssg awaits router navigation per route and renders once with no `<Suspense>`, so an un-warmed chunk would bake en fallback text and the description scrape would read the wrong language. Global rather than `beforeEnter` on the record: `beforeEnter` skips param-only navigation, and the globe menu's locale switch is exactly that (same record, new `:textLocale`)
- **Warm-up failure**: mid-session on the client (offline, or a stale tab importing a re-hashed chunk after a deploy) the guard hard-navigates to the target URL to pick up fresh HTML and chunk URLs; on an initial load it proceeds and the reader renders the en fallback
- **`installChunkErrorRecovery`**: after a deploy purges old hashed chunks, a stale tab's next lazy route import fails (the hosting fallback answers the miss with `index.html`, which fails as a module script) and vue-router would swallow the aborted navigation. `router.onError` completes it as a full page load, once per URL (`sessionStorage` key `stargazer.chunk-recovery`), so a persistent failure does not loop

### Skill-Locale Chunks (`/src/utils/dataLoader.ts`)

- **en/zh eager**: `loadSkillLocales` bundles both; the search index, guide panels, and the en fallback read them synchronously
- **One lazy chunk per other language**: `scripts/import-skills.ts` emits `src/locales/skill/<code>/index.ts`, whose eager same-directory glob inlines that language's JSON; `loadSkillLocale(code)` dynamically imports it, promise-cached per locale, and a rejected load is evicted so the next call retries
- **Preload on its own pages**: chunk files are named `<code>-<hash>.js`; `processRenderedPage` looks the file up in `dist/assets` and injects `<link rel="modulepreload">` into that language's skill pages, saving a round trip on cold loads (the primary path for shared links into non-en/zh pages)
- **Synchronous reads**: rendering uses `getSkillFile` / `getSkillLocaleDict`, which return `null` until the chunk is warm, hence the route guard

### Locale Axes (`/src/utils/routeLocale.ts`, `/src/App.vue`, `/src/stores/i18n.ts`)

```typescript
export function splitLocalePath(path: string): { locale: AppLocale | null; rest: string } {
  const match = path.match(/^\/(en|zh)(\/.*)?$/)
  if (!match) return { locale: null, rest: path }
  return { locale: match[1] as AppLocale, rest: match[2] ?? '' }
}
```

- **Invariant**: the regex stays `(en|zh)`. It is the app-locale classifier shared by `useRouteLocale`, the `App.vue` store sync, and `useLocaleToggle`; widening it to the skill-locale set would pin chrome to a language with no chrome strings and make the header toggle rewrite content URLs
- **`App.vue` sync**: `i18n.initialize()` runs at setup (idempotent) so the header on SSG-only routes resolves translation keys; a `route.path` watcher applies the prefix with `setLocale(locale, { persist: false })`, because following a shared `/zh/...` link must not overwrite the saved preference. `/ko/...` parses as unprefixed: the watcher no-ops, the page bakes with en chrome, and the saved preference applies after mount like the unprefixed shells
- **Post-mount reads**: `initializeSkillLocale()` always, `initializeLocale()` only on unprefixed routes (prefixed routes are language-pinned by the path). `?l=en|zh` on an unprefixed URL is an external contract: it pins the chrome locale for the recipient and persists it
- **`<html lang>`**: the build stamps it from the URL prefix; on the client every write funnels through `applyDocumentLang`, where `htmlLangOverride` keeps the content locale on skill pages. `setupSkillContentMeta` sets it with an owner token so keyed remounts in either order cannot clear a newer owner. Chrome regions that stay in the app locale (`App.vue` header, `SkillsSelection`, the `SkillReader` locale hint, the search overlay) carry their own `:lang`, since screen readers and per-language font fallback follow the nearest ancestor
- **`effectiveSkillLocale`** (saved `stargazer.skillLocale` preference, else app locale) prefixes skill links on surfaces with no content context: `/skills` roster tiles, guide panel links, modal seeding. Skill pages read the URL prefix

### Page Meta (`/src/utils/contentMeta.ts`, `/vite.config.ts`)

- **`setupSkillContentMeta(name, locale)`** runs in `SkillSections` setup on SSG and client: title, keywords, `og:title` / `og:image` / `og:url`, canonical, and `hreflang` alternates for all 16 locales plus `x-default` (en). Skipped when `ContentInModalKey` is provided, so the skill modal leaves the host page's head alone. The description is not written here
- **`setupGuideContentMeta(locale: Ref<AppLocale>)`** passes a computed to `useHead`: `/en/guide` and `/zh/guide` share one `GuideView` instance, so the head must follow the locale reactively
- **Build-time description** (`extractContentDescription`, skill routes only): the first `<article>` in the rendered HTML, its first two `<p>` elements, tags and `[[...]]` highlight markers stripped, cut at 150 characters on a word boundary (spaceless text such as zh cuts at 150). Contract: `SkillSections.vue` is the only `<article>` on a skill page; a different root tag or an earlier article would silently change every description. A miss logs a warning and leaves the `index.html` default
- **Essay snippets stay client-side**: `src/content/skill/<slug>/<Hero>.<lang>.vue` pieces teleport into per-section anchors that are template refs, unset during SSR, so they render only after hydration. The description scrape reads the skill text and does not depend on them
- **`dedupeAssetLinks`**: vite-ssg emits asset `<link>` tags in two passes (static manifest and dynamic-import resolution), so modules reachable from both appear twice; the first occurrence per href is kept
- **`@unhead/vue` version**: the root dependency (`^2.1.4`) stays within the range `vite-ssg` itself depends on (`^2.1.2`) so npm hoists one copy; a different major would install a second instance and split the app's `useHead` from vite-ssg's server head. Bump the two together

### SSR Guards (`/src/stores/gameData.ts`)

```typescript
// Interactive game (home, share, teams): stays empty during SSG.
const initializeData = () => {
  if (dataLoaded.value || import.meta.env.SSR) return
  loadIntoState()
}
// Content pages (skill browser, guide): same data, no SSR guard.
const initializeContentData = () => {
  if (dataLoaded.value) return
  loadIntoState()
}
```

- **Two loaders, one body**: `SkillsBrowser` and `GuideView` call `initializeContentData()` synchronously in setup, so the roster grid and its crawlable links bake and the client's first render matches (the data loaders are deterministic glob reads). Home, share, and teams call `initializeData()`, keeping game state out of the baked HTML
- **Browser APIs**: anything touching `window`, `document`, `Image`, `matchMedia`, or storage at module or setup scope checks `import.meta.env.SSR` first (`utils/storage.ts`, `useDragDrop`, `useGridSwap`, `useScrollLock`, `useTouchDetection`, `useRecentHeroes`, `GridInfoToggle`, `ArenaDropdown`)
- **Static content reads loaders, not the store**: `GridSnippet` resolves portraits through `loadCharacterImages()` directly, so diagrams render identically with or without store state

### PvP Reports (`/scripts/guideReports.ts`, `/src/utils/imageAssets.ts`)

The `guideReports` Vite plugin hydrates each `src/content/pvp/s<N>/index.template.html` into `dist/guide/pvp/s<N>/index.html`. A report is a standalone page exported by the PvP project with its own styles and scripts: it sits outside Vue routing and the SSG route list, and reaches the sitemap only because `vite-ssg-sitemap` scans the built HTML in `dist/`.

- **Client build only**: the plugin skips the dev server and vite-ssg's SSR build, so a report URL resolves only in a production build
- **Placeholders**: `{{asset:<type>/<slug>}}`, with type `character`, `artifact`, or `seasonal-artifact` and a lowercase slug; the PvP project's `report.mjs` writes them
- **Shared images**: `character` and `artifact` resolve to the hashed files the app itself ships, so a report adds no image of its own. The plugin reads only the imports of `imageAssets.ts`, which selects the roster's display variants and leaves out other variants cut from the same PNGs (`loadMatcherPortraits`)
- **Emitted filenames**: each vite-imagetools module carries one `__VITE_ASSET__` reference, which the bundler resolves to the final hashed name. This leans on a Vite internal; a module without exactly one reference fails the build
- **Seasonal icons**: `seasonal-artifact` resolves to the remote `seasonArtifactImageUrl`, which the build cannot verify, so a wrong slug surfaces only as a broken image in the browser
- **Build failures**: a placeholder naming a missing local image, a placeholder left unresolved (unknown type or malformed slug), and a `guide/pvp/s<N>/index.html` already present in `public/` or the bundle

## Hosting (`/public/_redirects`, `/public/_headers`)

Netlify serves `dist/` as static files first; `_redirects` rules apply to what is left, except the forced (`!`) host rule:

| Rule                                                          | Purpose                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `https://afkj-stargazer.netlify.app/* → stargazer.tmdict.com` | Canonical host, `301!`                                                            |
| `/en/about`, `/zh/about → /`                                  | Retired page; the content lives in the About modal                                |
| `/en/mechanics → /en/guide`, `/zh/mechanics → /zh/guide`      | Retired path                                                                      |
| `/wandwars → /`                                               | Retired feature                                                                   |
| `/* → /index.html 200`                                        | SPA fallback for `/teams` and unknown paths (the router sends unknown paths home) |

- **`_headers`**: `/assets/*` is hashed output, cached `immutable` for a year; `index.html` and other unhashed files keep Netlify's revalidate default. `/site.webmanifest` gets an explicit `application/manifest+json` type because Netlify has no mapping for the extension
- **`forms.html`**: a hidden twin of the contact form so Netlify form detection registers it at deploy; its field names must match `ContactForm.vue`, and the sitemap excludes it

## Related Documentation

- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill locale files, the importer, and the skill browser
- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - The `?g=` share payload decoded after hydration
