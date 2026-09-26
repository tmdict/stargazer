# Skill Pages

Three surfaces show a hero's in-game skill text: the `/skills` browser, the skill modal, and a pre-rendered page at `/<code>/skill/<slug>` for each of the 16 languages × every hero. Each shows the skill text, tag chips and optional commentary.

Two locale axes run through all of it. Skill text and the hero name follow the text locale (`SkillLocale`, the languages in `SKILL_LOCALES`, which is also the URL prefix). Chips, labels and the roster follow the chrome locale (`AppLocale`, en or zh). All 16 languages cannot ship in the main bundle, yet a pre-rendered page must bake its real text in one render pass. Most of the design follows from those two facts.

## Locale files

`npm run import:skills` writes `src/locales/skill/<code>/` for every row of `SKILL_LOCALES` from the upstream data feed. The directory is prettier-ignored and never hand-edited.

| File             | Written by      | Holds                                                     |
| ---------------- | --------------- | --------------------------------------------------------- |
| `<slug>.json`    | `import:skills` | one hero's skill text                                     |
| `_keywords.json` | `import:skills` | glossary text for `[[label\|key]]` tokens                 |
| `_charms.json`   | `import:charms` | seasonal charm text ([Seasonal Content](./SEASONAL.md))   |
| `index.ts`       | `import:skills` | the lazy chunk module, in every language except en and zh |

A hero file holds the feed's localized name in `_hero.name`, the official labels for the ultimate and EX slots in `_terms`, and one entry per slot in `SLOT_ORDER`. A slot has a name `n`, descriptions `d` where `d[i]` is level i+1, and on `ex` only, refinement tiers `r`. `SLOT_ORDER` is both the render order and the set of slot names commentary snippets can fill.

Files starting with `_` hold per-language data rather than a hero. They travel in the same globs and chunks, and `splitSkillDict` separates them at load time, so slug walks and the search index see only heroes. The pre-render route walk skips them too.

The importer requires `_meta.terms` and `_meta.keywords` in each feed. It fails when languages disagree on the hero set or a hero's slot set, or when a keyword token has no glossary entry. Heroes missing from the feed, tag attachments pointing at a slot or level the hero lacks, and locale directories not in `SKILL_LOCALES` are warnings. It only writes files whose content changed. Adding a language is one `SKILL_LOCALES` row (the `feed` column maps the feed's own code to the BCP-47 `code`) and a re-run.

Because every language must cover exactly the en hero set, `hasSkillLocale(slug)` answers from en alone. It gates the info button, the modal and the reader, so a hero with data but no text never shows a dead link.

## Loading languages

```
  import:skills ──▶ src/locales/skill/<code>/*.json
                            │
            ┌───────────────┴─────────────┐
            ▼                             ▼
      en, zh: eager glob            other languages: one lazy
      in the main bundle            chunk each (index.ts)
            │                             │
            │                             ▼
            │                       loadSkillLocale ◀── warmSkillLocale,
            │                             │             modal, search
            ▼                             ▼
      getSkillFile, getSkillLocaleDict, getSkillKeywords:
      synchronous, null until the language is warm
```

en and zh are always loaded, since search, the guide panels and the en fallback read them synchronously. Each other language is one chunk: its `index.ts` globs its own directory eagerly, so a single dynamic import brings in the whole language. `loadSkillLocale` caches the promise per language and evicts a rejected one, so the next call retries. Components render through the synchronous getters, which keeps `SkillSections` a synchronous component.

That puts the burden on whoever navigates. `warmSkillLocale` (`src/router/routes.ts`) awaits the chunk before any `skill` route resolves. vite-ssg renders each route once with no `<Suspense>`, so without the guard a page would bake en fallback text and the meta description would come from the wrong language. The guard is a global `beforeResolve` because `beforeEnter` skips param-only navigation, and the globe menu's language switch is exactly that. If the chunk fails mid-session (offline, or a stale tab after a deploy), the guard hard-navigates to the target URL to pick up fresh HTML. On the initial load it proceeds and the reader shows the en fallback.

The modal awaits its own load (`useModalSkillLocale`) and keeps showing the previous language until the new one arrives, falling back to en on failure. On a pre-rendered non-en/zh page, the build adds a `modulepreload` for that language's chunk, found in `dist/assets` by its `<code>-<hash>.js` name, to save a round trip on cold loads.

## Text and names

Skill text uses one small grammar in `src/utils/textHighlight.ts`: `[[value]]` is a highlight, `[[label|key]]` is a keyword whose tooltip text is `key` in that language's `_keywords.json`, and `<ATK>`-style tags are stat pills. `HIGHLIGHT_RE` and `splitHighlightToken` are imported by search, both importers and `vite.config.ts`, so validation, rendering and the description scrape cannot disagree. Keyword spans sit in `v-html` output, so `SkillKeywordTooltip` listens on the `SkillSections` article instead of on each span.

A hero's display name is `_hero.name` in the text locale, then the curated en name, then the slug (`heroDisplayName`). The curated en/zh names in `src/locales/character/` stay on chrome surfaces and serve as search aliases. The ultimate and EX headings are the `_terms` label plus the skill name, and the app's own slot labels are only a fallback there.

## Pages and meta

`SkillsBrowser` backs both `/skills` and every hero page, so the URL is the whole state. Roster links point at the page's text locale on a hero page, and at `effectiveSkillLocale` (the saved globe choice in `stargazer.skillLocale`, else the chrome locale) on the index and on other surfaces with no text locale of their own. The globe menu (`SkillLocaleMenu`) switches text only, and the header toggle switches chrome only.

`setupSkillContentMeta` runs in `SkillSections` on the server and the client. It sets the title, Open Graph tags, canonical and `hreflang` alternates for every language, and takes `<html lang>` for the text locale through an owner token, so keyed remounts in either order cannot clear a newer owner. The modal provides `ContentInModalKey`, which skips all of this so the popup leaves the host page's head alone.

The meta description is not set at runtime. The build reads the first `<article>` of each rendered skill page, takes its first two paragraphs, strips tags and `[[...]]` markers, and cuts at 150 characters on a word boundary (spaceless text such as zh cuts at 150). `SkillSections` must stay the only `<article>` on a skill page: a different root tag or an earlier article would silently change every description. A miss logs a warning and keeps the default description.

## Tags

Tags live in the character data file (`src/data/character/<slug>.json`). The importer never writes them and only checks that each attachment exists in the hero's kit:

```jsonc
"tags": {
  "special-target": [{ "skill2": 1 }],
  "initial-energy-300": []   // empty: character-level only
}
```

Each attachment is `{ slot: level }`. `useSkillTags` gives the per-level and per-character unions. The chip strip filters levels, and refinement rows and charm rows carry no tags, so any active chip hides them. A slot heading's chips link to `/skills?tag=<name>`, which seeds the roster filter. A tag's label is `src/locales/app/<tag>.json`, so adding a tag is data plus one locale file.

## Commentary snippets

An optional `src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue` (en or zh) adds commentary. `SkillSections` picks the text locale if it is an app locale, then the chrome locale, then en. Each slot of `SkillSnippets` teleports into the matching section's anchor from `useSnippetAnchors`. The anchors are template refs, unset during pre-rendering, so commentary appears only after hydration and never reaches the description scrape. Without anchors, as in the guide panels, the slots render inline in slot order. A grid diagram pairs `<Hero>.data.ts` with `GridSnippet`, which resolves portraits through `loadCharacterImages`, so data files import no images.

## Search

`SkillSearchOverlay` mounts once at the app root and teleports only after mount, so pre-rendered HTML carries just the triggers. ⌘K or Ctrl+K toggles it, and `/` opens it outside text fields. The same overlay has a select mode (`useSearchOverlay().openSelect`) that hands the chosen hero to its opener, such as the Arena roster. Escape is handled in the capture phase and any route change closes the overlay, so a select handler never outlives its page. Recent picks persist under `stargazer.recentHeroes`. A result links to `/<hit locale>/skill/<slug>#<slot>`, resolved by the section ids and the router's `scrollBehavior`.

`useSkillSearch` follows these rules:

| Rule     | Behavior                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------- |
| Corpus   | every warm language; the first non-empty query loads the missing chunks and re-runs as each one lands       |
| Names    | `_hero.name` per language plus the curated en/zh aliases; one character is enough                           |
| Deep     | from 3 characters (2 for Han, kana or Hangul), adds skill names, descriptions and charm text                |
| Priority | text locale, then chrome locale, then table order; each hit records the language it matched and links there |
| Dedup    | one hit per hero and slot at the lowest level, charm hits share one slot, at most 3 hits per hero           |
| Ranking  | name matches first, then hit count, then curated name                                                       |
| Picker   | `matchCharacterNames` (the on-grid picker) searches warm languages only and never loads a chunk             |

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, hydration and hosting
- [Seasonal Content](./SEASONAL.md): charm data and the charm importer
- [Guide](./GUIDE.md): the mechanics page built from the same tags
