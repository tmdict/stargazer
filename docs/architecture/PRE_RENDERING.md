# Pre-Rendering

The production build uses vite-ssg to write static HTML for every crawlable page, and the same bundle hydrates each page into the full app. Content pages bake their bodies: the skill pages, the `/skills` roster and the guide. The interactive pages `/` and `/share` bake only chrome and meta tags, so each still has its own canonical and resolves on direct navigation. `/teams` is client-only. Game state never enters the baked HTML.

The hard rule is that the client's first render must equal the baked HTML, or hydration breaks. Everything a pre-rendered view reads while rendering must therefore be synchronous and deterministic, or awaited before the render starts.

## How a build runs

```
  vite-ssg build
  │
  ├──▶ client build ──────────────────────▶ dist/assets/ (hashed chunks)
  │    guideReports plugin ───────────────▶ dist/guide/pvp/s<N>/
  │
  ├──▶ SSR build, then per route ─────────▶ dist/**/*.html
  │    each getSSGRoutes path is rendered,
  │    then processRenderedPage (reads dist/assets/)
  │
  └──▶ onFinished: sitemap and robots.txt
       from every .html in dist/
```

`npm run build` runs the type check and `build:ssg` in parallel. `build:spa` skips pre-rendering, and the dev server is SPA only.

`getSSGRoutes` (`vite.config.ts`) lists the pages. The skill pages come from the filesystem: every non-underscore `.json` under `src/locales/skill/<code>/` becomes a page, so 16 languages × every hero with text. A locale directory missing for a `SKILL_LOCALES` row fails the build, because that table also drives the globe menu and `hreflang`, and a silent skip would ship links to pages that do not exist. Guide pages come from `APP_LOCALES` × `GUIDE_PAGES` ([Guide](./GUIDE.md)).

`processRenderedPage` stamps `<html lang>` from the URL prefix and removes duplicate asset links, since vite-ssg emits asset `<link>` tags in two passes and a module reachable from both appears twice. On skill pages it also preloads the language chunk and writes the meta description ([Skill Pages](./SKILL_PAGES.md)). The chunk lookup reads `dist/assets`, which works because vite-ssg finishes the client build before rendering.

`src/main.ssg.ts` and `src/router/index.ts` share `routes`, `scrollBehavior` and `installRouterGuards` from `src/router/routes.ts`, so the guard set cannot drift between the two entries. The skill-locale guard and how languages load are in [Skill Pages](./SKILL_PAGES.md).

## Static input

The game-data store has two loaders with one body. `initializeContentData()` also runs during pre-rendering, and the skill browser and guide views call it in setup so the roster and its crawlable links bake. `initializeData()` returns early during SSR, and the home, share and Teams views call it, which keeps game state out of the baked HTML. Both read deterministic glob imports, so the client's first render matches.

Any code touching `window`, `document`, `Image`, `matchMedia` or storage at module or setup scope checks `import.meta.env.SSR` first. Static content reads the data loaders directly instead of the store: `GridSnippet` resolves portraits through `loadCharacterImages()`, so a diagram renders the same with or without store state.

## Two locale axes

The skill-text locale is the URL prefix on skill pages and has 16 values. The chrome locale is en or zh. `splitLocalePath` (`src/utils/routeLocale.ts`) is the chrome classifier used by `useRouteLocale`, the `App.vue` store sync and `useLocaleToggle`, and its regex must stay `(en|zh)`. A `/ko/...` path then parses as unprefixed, so chrome is never pinned to a language without chrome strings, and the header toggle flips the chrome preference instead of rewriting the content URL.

`App.vue` watches the path and applies an en/zh prefix with `setLocale(locale, { persist: false })`, because following a shared `/zh/...` link must not overwrite the saved preference. Saved preferences apply only after mount (`initializeSkillLocale` always, `initializeLocale` on unprefixed routes), so hydration matches the English-chrome HTML before text and link hrefs swap. `?l=en` or `?l=zh` on an unprefixed URL is an external contract: it pins the chrome locale for the recipient and saves it.

## Head tags

vite-ssg creates its own unhead instance on the server and the client, and `src/main.ts` creates one from `@unhead/vue/client`. The root `@unhead/vue` range must stay within the range vite-ssg depends on, so npm installs one copy. A second copy would split the app's `useHead` calls from the server head. Bump the two together.

`/share` and `/skills` set their own title and canonical through `useHead`, and `/` keeps the `index.html` defaults.

## Chunk error recovery

A deploy purges the previous build's hashed chunks, so a stale tab's next lazy route import fails: the host answers the miss with `index.html`, which fails as a module script, and vue-router swallows the aborted navigation. `installChunkErrorRecovery` completes that navigation as a full page load onto the new build. It remembers the last recovered URL in `sessionStorage` (`stargazer.chunk-recovery`), so a persistent failure does not loop.

## PvP reports

The `guideReports` plugin (`scripts/guideReports.ts`) turns each `src/content/pvp/s<N>/index.template.html` into `dist/guide/pvp/s<N>/index.html`. A report is a standalone page from an external report generator with its own styles and scripts. It sits outside Vue routing and the route list, and reaches the sitemap only because the sitemap scans the built HTML. The plugin runs only in the client production build, so a report URL does not resolve in the dev server.

The generator writes placeholders in the form `{{asset:<type>/<slug>}}`. `character` and `artifact` resolve to the hashed images the app itself ships, so reports share them instead of embedding copies. `seasonal-artifact` resolves to the icon's URL on the image host.

The plugin takes images only from the imports of `src/utils/imageAssets.ts`, which holds the roster's display variants, so other variants cut from the same PNGs stay out of the reports. That file must import nothing local, because its integration test copies it on its own. Each image module must carry exactly one `__VITE_ASSET__` reference, which the bundler resolves to the final file name. This leans on a Vite internal, so re-run `tests/integration/guideReports.test.ts` after a Vite upgrade.

The build fails on a placeholder naming a missing image, a placeholder left unresolved, or a `guide/pvp/s<N>/index.html` already present in `public/` or the bundle.

## Hosting

The host serves `dist/` as static files first and applies `public/_redirects` to the rest. The deploy subdomain redirects to the canonical host with a forced rule. Retired paths redirect to their current pages. Everything else falls back to `/index.html` with status 200, which serves `/teams` and sends unknown paths home through the router.

`public/_headers` caches `/assets/*` as `immutable` for a year, since hashed output never changes behind a URL. Unhashed files keep the host's revalidate default. `/site.webmanifest` gets an explicit `application/manifest+json` type, because the host has no mapping for that extension.

`public/forms.html` is a hidden twin of the contact form, published so the host's form detection registers the form at deploy. Its field names must match what `ContactForm.vue` submits. The sitemap excludes it along with `/share`.

## Related documentation

- [Skill Pages](./SKILL_PAGES.md): skill locale chunks, the warm-up guard and skill page meta
- [Guide](./GUIDE.md): guide pages and season summaries
- [URL Serialization](./URL_SERIALIZATION.md): the `?g=` payload decoded after hydration
