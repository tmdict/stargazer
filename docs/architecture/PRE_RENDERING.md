# Pre-Rendering

The production build uses vite-ssg to write static HTML for every crawlable page. In the browser `src/main.ts` mounts a plain app, which renders the page again in place of the baked HTML, so the baked HTML serves crawlers and the first paint. Content pages bake their bodies: the skill pages, the `/skills` hero list, the guide and the Help page. The interactive pages bake only chrome and meta tags, so each still has its own canonical and resolves on direct navigation, and `/teams` is client-only. Game state never enters the baked HTML.

The hard rule is that the client's first render must equal the baked HTML, or the page jumps when the app replaces it. Everything a pre-rendered view reads while rendering must therefore be synchronous and deterministic, or awaited before the render starts. The hero list on a skill page is the one exception. The picker repeated on every skill page would be most of each page and of the build's time, so the baked page holds its links as plain hero names in the page's language, and the browser draws the picker in their place.

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

`npm run build` runs the data step, the type check and the pre-rendered build; `build:ssg` is the same without the type check. `build:spa` skips pre-rendering, and the dev server is SPA only.

`getSSGRoutes` (`vite.config.ts`) lists the pages. The skill pages come from the skill text: each hero with skill text in a language gets a page in that language. A `SKILL_LOCALES` row with no hero text fails the build, because that table also drives the globe menu and `hreflang`, and a silent skip would ship links to pages that do not exist. Guide pages come from `GUIDE_PAGES`, and the Help page from `APP_LOCALES`.

`processRenderedPage` stamps `<html lang>` from the URL prefix and `<body lang>` with the app locale the page was rendered in (English under a text-only prefix), the pair the i18n store keeps in the browser ([Architecture](../ARCHITECTURE.md)). It also removes duplicate asset links, since vite-ssg emits asset `<link>` tags in two passes and a module reachable from both appears twice. On skill pages it also preloads the language chunk and writes the meta description ([Skill Pages](./SKILL_PAGES.md)). The chunk lookup reads the client build's manifest in `dist/.vite`, which works because vite-ssg finishes the client build before rendering.

`src/main.ssg.ts` and `src/router/index.ts` share `routes`, `scrollBehavior` and `installRouterGuards` from `src/router/routes.ts`, so the guard set cannot drift between the two entries. The skill-locale guard and how languages load are in [Skill Pages](./SKILL_PAGES.md).

## Static input

The game-data store has two loaders with one body. `initializeContentData()` also runs during pre-rendering, and the skill browser and guide views call it in setup so the hero list's crawlable links bake. `initializeData()` returns early during SSR, and the home, share and Teams views call it, which keeps game state out of the baked HTML. Both read deterministic glob imports, so the client's first render matches.

Any code touching `window`, `document`, `Image`, `matchMedia` or storage at module or setup scope checks `import.meta.env.SSR` first. Static content reads the data loaders directly instead of the store: `GridSnippet` resolves portraits through `loadCharacterImages()`, so a diagram renders the same with or without store state.

A page is baked once per path, so nothing from the query string is in its HTML. A page that reads its query or hash, such as the tag link on `/skills` ([Skill Pages](./SKILL_PAGES.md)), applies it after mount.

## Two locale axes

The skill-text locale is the URL prefix on skill pages, one of `SKILL_LOCALES`. The chrome locale is one of `APP_LOCALES` (en, zh, ko). `splitLocalePath` (`src/utils/routeLocale.ts`) is the chrome classifier used by `useRouteLocale`, the `App.vue` store sync and `useLocaleSwitch`, and its prefix set must stay `APP_LOCALES`. A path whose prefix only names a skill-text language, such as `/ja/...`, then parses as unprefixed, so chrome is never pinned to a language without chrome strings.

A page whose prose is its content carries its language in its address: the skill pages, in every skill-text language, and Help, in every app locale. Every other page has one address and shows in the site language, and those with content to find in search, `/skills`, the guide pages, the PvP team generator and Who Would Win?, are pre-rendered in English.

`App.vue` watches the path and hands its app-locale prefix to `applyAddressLocale` (`src/stores/i18n.ts`), which sets the chrome locale without saving it, because following a shared `/zh/...` link must not overwrite the saved preference.

| Path                                            | Chrome locale                                          |
| ----------------------------------------------- | ------------------------------------------------------ |
| Help page, `/zh/help`                           | the prefix, since the page is written in that language |
| Skill page under an app locale, `/zh/skill/...` | the saved preference, else the prefix                  |
| Anything else, `/`, `/guide`, `/ja/skill/...`   | the saved preference, else the locale in use           |

A skill page's prefix names only its text, so a saved site language frames it as it frames the skill popup, and the prefix stands in for a visitor who has saved none, which is also how the page is pre-rendered. The last row is what returns a visitor to their saved language on leaving a Help page in another one. Saved preferences are read only after mount (`initializeSkillLocale`, `initializeLocale`), so the first render matches the baked HTML before text and link hrefs swap. `?l=<app locale>` on an unprefixed URL (`?l=en`, `?l=zh`, `?l=ko`) is an external contract: it pins the chrome locale for the recipient and saves it.

## Head tags

vite-ssg creates its own unhead instance on the server and the client, and `src/main.ts` creates one from `@unhead/vue/client`. The root `@unhead/vue` range must stay within the range vite-ssg depends on, so npm installs one copy. A second copy would split the app's `useHead` calls from the server head.

`/share` and `/skills` set their own title and canonical through `useHead`, and `/` keeps the `index.html` defaults. The build fills the site's address into `index.html` from `SITE_ORIGIN` in `src/lib/site.ts`, the one place it is written.

## Chunk error recovery

A deploy purges the previous build's hashed chunks, so a stale tab's next lazy route import fails: the host answers the miss with `index.html`, which fails as a module script, and vue-router swallows the aborted navigation. `installChunkErrorRecovery` completes that navigation as a full page load onto the new build. It remembers the last recovered route path in `sessionStorage` (`stargazer.chunk-recovery`, for example `"/teams"`), so a persistent failure does not loop. `reloadOntoCurrentBuild` does the reloading. Components fetched on first use through `defineLazyComponent` call it with the page's own address when their file fails to load.

## PvP reports

The `guideReports` plugin (`scripts/guideReports.ts`) turns each season's report template from the data pack into `dist/guide/pvp/s<N>/index.html`. A report is a standalone page from an external report generator with its own styles and scripts. It sits outside Vue routing and the route list, and reaches the sitemap only because the sitemap scans the built HTML. The plugin runs only in the client production build, so a report URL does not resolve in the dev server.

The generator writes placeholders in the form `{{asset:<type>/<slug>}}`. `character` and `artifact` resolve to the hashed images the app itself ships, so reports share them instead of embedding copies.

The plugin takes images only from the imports of `src/utils/imageAssets.ts`, which holds the hero list's display variants, so other variants cut from the same PNGs stay out of the reports. That file must import nothing local, because its integration test copies it on its own. Each image module must carry exactly one `__VITE_ASSET__` reference, which the bundler resolves to the final file name. This leans on a Vite internal, which the plugin's integration test exercises.

The build fails on a placeholder naming a missing image, a placeholder left unresolved, or a `guide/pvp/s<N>/index.html` already present in `public/` or the bundle.

Each report comes with a summary, which the guide index shows. The external report generator writes it with the report and owns its format, so nothing here derives or edits its numbers. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) finds the summaries newest first, so a new season needs no entry in the code.

The guide index's card for the PvP team generator (`virtual:sl-preview`), and the Formation engine rules page and the Hero lists page (`virtual:formation-rules`), show parts of the PvP data file worked out once per build by `packModule` (`scripts/packModule.ts`), so they are in the baked HTML and no page loads the file.

## Hosting

The host serves `dist/` as static files first and applies `public/_redirects` to the rest. The deploy subdomain redirects to the canonical host with a forced rule. Retired paths redirect to their current pages, and a retired Chinese or Korean guide address keeps its language as `?l=`. Everything else falls back to `/index.html` with status 200, which serves `/teams` and sends unknown paths home through the router.

`public/_headers` caches `/assets/*` as `immutable` for a year, since hashed output never changes behind a URL. Unhashed files keep the host's revalidate default. `/site.webmanifest` gets an explicit `application/manifest+json` type, because the host has no mapping for that extension.

## Related documentation

- [Skill Pages](./SKILL_PAGES.md): skill locale chunks, the warm-up guard and skill page meta
- [URL Serialization](./URL_SERIALIZATION.md): the `?g=` payload decoded after mount
