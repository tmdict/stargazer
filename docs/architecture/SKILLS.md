# Skill System

## Overview

The skill system gives placed units abilities that paint tiles, draw arrows and lines, or spawn companions, and it keeps that state consistent through placement, movement, and removal. A separate skill page pipeline renders each hero's in-game skill text in 16 languages from importer-generated locale files.

## Design Principles

1. **Unit ownership**: A skill is keyed `characterId-team` and lives with its unit's placement; board-level effects (artifact arrows) are derived computeds instead
2. **One definition per hero**: The registry holds one `Skill` per base hero; synergy copies resolve to it while all instance state keys by the placed id
3. **Transactional lifecycle**: Place, move, swap, and remove run skill hooks inside `executeTransaction`, so a throwing `onActivate` rolls the whole operation back
4. **Refcounted paint channels**: Tile borders and fills count painters per color, so independent skills sharing a tile never clear each other
5. **Two locale axes**: Skill text follows `SkillLocale` (16 languages, the URL prefix); chrome follows `AppLocale` (en/zh)

## Architecture

```
┌─────────────────┐    ┌───────────────────┐    ┌──────────────────────┐
│ Grid components │───▶│ useGridContext    │───▶│ lib/characters       │
│ GridManager,    │    │ (one per board)   │    │ place / move / swap  │
│ SkillTargeting  │    │ Grid+SkillManager │    │ remove transactions  │
└────────▲────────┘    └───────────────────┘    └──────────┬───────────┘
         │ targetVersion-keyed computeds                   │ activate /
         │ (targets, paints, lines, modifiers)             ▼ deactivate
┌────────┴────────┐    ┌───────────────────┐    ┌──────────────────────┐
│ SkillManager    │◀───│ registry.ts       │◀───│ characters/*.ts      │
│ skill.ts        │    │ one Skill per hero│    │ seasonal/*.ts        │
└─────────────────┘    └───────────────────┘    └──────────────────────┘
```

Each board's context (`/src/composables/useGridContext.ts`) owns a `Grid` and a `SkillManager` and passes both to the character operations; the Pinia `skill` and `character` stores are thin adapters over the active board for debug and roster consumers.

## Core Components

### Skill Registry (`/src/lib/skills/registry.ts`)

- **Generic base**: The registry stores `SkillBase<unknown>`; `skill.ts` binds `Skill = SkillBase<SkillContext>` through typed wrappers because `SkillContext` references `SkillManager` (circular import otherwise)
- **Synergy lookup**: `getCharacterSkill` and `hasSkill` strip the synergy band via `decomposeUnitId` (see [GRID.md](./GRID.md)); only the definition lookup strips, so builders read `ctx.characterId`, never their config id
- **Companion detection**: `hasCompanionSkill` is derived from `companionColorModifier` / `companionImageModifier` on the definition
- **Self-registration**: `import.meta.glob` at the bottom of `skill.ts` eagerly imports `characters/*.ts` (permanent heroes) and `seasonal/*.ts` (deleted with the season); `registerSkill` runs as an import side effect

### SkillManager (`/src/lib/skills/skill.ts`)

Non-reactive class, one per board, constructed with `SkillLookups` (`factionOf`, `classOf`) injected from the game-data store because that data lives outside the pure lib.

- **Key**: `characterId-team`, so the same unit can be active on both teams
- **Activation**: `activateCharacterSkill` returns `false` and drops the active entry when `onActivate` throws; the surrounding transaction rolls the placement back
- **Update sweep**: `updateActiveSkills` isolates each skill in its own try/catch; a unit that vanished without going through removal is fully deactivated so companions and capacity are not leaked
- **Paint channels**: `tileColorModifiers` (border) and `tileFillModifiers` (fill) are `Map<hexId, Map<color, refcount>>`; `paintTiles` diffs against the instance's previous set, and `TilePaint.fill` selects the channel for both add and remove
- **Lines**: `setSkillLines` replaces the instance's set outright (rendered flat, no diff needed)
- **Reactivity bridge**: `targetVersion` increments on every visible mutation; the board's computeds read it to re-derive from this class

### Character Operations (`/src/lib/characters/`)

`executePlaceCharacter`, `executeRemoveCharacter`, `executeMoveCharacter`, and `executeSwapCharacters` take `(grid, skillManager, ...)` and wrap tile mutation plus skill activation in `executeTransaction` (`transaction.ts`). Companions cannot be placed directly; only a skill creates them.

### Builders (`/src/lib/skills/utils/builders.ts`)

| Factory                                  | Behavior                                                                                                     | Examples                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| `createTargetingSkill`                   | Stores one target; `arrowType` adds a caster-to-target arrow, omitted when `calculateTarget` builds its own  | Talene, Ravion, Aliceth             |
| `createTileHighlightSkill`               | Paints one tile (border, or fill with `fill: true`), unpainting the previous target on update                | Daimon, Hepler, Thador              |
| `createTilePaintSkill` / `withTilePaint` | Paints the full set `calculate(ctx)` returns for the current grid, diffed by `paintTiles`                    | Himmel; Evie, phantimal (decorator) |
| `createLineSkill` / `withSkillLine`      | Draws the `SkillLine[]` that `calculate(ctx)` returns                                                        | Callan, Satrana, Zandrok            |
| `createCompanionSkill`                   | Spawns `count` companions on random free tiles, raises capacity by `count`, rolls back and throws on failure | Phraesto, Zanie, Elijah-Lailah      |

- **Composition**: The registry allows one skill per character, so a hero with several behaviors decorates a base (Elijah-Lailah is `withSkillLine(withTilePaint(createCompanionSkill(...)))`); decorators run after the base hooks and clear before them
- **Companion ids**: `N * grid.companionIdOffset + characterId`, so a companion resolves to its main hero for lookups
- **Hand-written lifecycles**: Kulu (static zone with no `onUpdate`, relying on refcounts where both teams' zones overlap) and Reinier pass an object straight to `registerSkill`

### Visuals

- **Palette**: Every effect color comes from `SKILL_COLORS` in `utils/colors.ts`, referenced by name so a hue shared across heroes retunes in one place
- **Lines** (`utils/line.ts`): A `SkillLine` runs border to border by default; `fromCorner` / `toCorner` (indices per `Layout.hexCornerOffset`) pin it to hex corners. On one hex that is a tile edge (`outlineEdges`, `zoneOutline` for a radius around the caster); across two hexes it is a lane boundary that `SkillTargeting` clips to the visible region (`clipLaneBoundary`)
- **Colors per visual**: Arrows take `targetingColorModifier` from the definition; lines and paints carry their own color, so they render for any skill
- **Toggle**: `SkillTargeting.vue` (arrows, lines) and `GridTiles.vue` (paints) render only while `showSkills` is on

Companion and targeting mechanics are documented in [COMPANION.md](./skills/COMPANION.md) and [TARGETING.md](./skills/TARGETING.md).

## Adding a Skill

1. Add `/src/lib/skills/characters/<slug>.ts` (or `seasonal/` for a rotating unit). A block comment above `registerSkill` describing the in-game behavior is the skill's only documentation; the object carries just `id` and `characterId`.
2. Pick a factory from `utils/builders.ts`; target helpers live in `utils/distance.ts` (`findTarget`, `TargetingMethod`, `frontmostUnit`, `rearmostUnit`), `utils/ring.ts` (`rowScan`, `spiralSearchFromTile`), `utils/targeting.ts`, and `utils/symmetry.ts`.
3. Take colors from `SKILL_COLORS` and data-store facts from `ctx.lookups` (`classOf`, `factionOf`), never from the store directly.
4. If no factory fits, register a plain object and mirror every paint or line add with its remove (`paintTiles` / `clearPaintedTiles` handle the diff).
5. Reference files: `characters/himmel.ts` (tile paint with `classOf`), `characters/elijah-lailah.ts` (companion plus decorators), `characters/kulu.ts` (custom lifecycle).

## Artifact Targeting (`/src/lib/skills/artifact.ts`)

Artifacts that act on specific units (Enlightening: rearmost ally; Vanguard: frontmost; Valorshield: both) draw arrows from the slot's host cell. This is a derived value, not a Skill: an artifact has no hex and no `characterId`, so nothing in the placement lifecycle could track it.

- **Table**: `ARTIFACT_TARGETING` keyed by artifact id, `(grid, team) => (TargetCandidate | null)[]`, using the same `frontmostUnit` / `rearmostUnit` helpers as hero skills so phantimals and companions count identically; seasonal entries sit under a season comment and are deleted with the season (see [SEASONAL.md](./SEASONAL.md))
- **Derivation**: `artifactTargetArrows(grid, team, artifactId)` anchors on `artifactHostHex` (`/src/lib/grid.ts`) and dedupes hexes; `useGridContext.artifactArrows` is a `computed` over both slots and the grid, so no wiring in the place/move/remove paths
- **Rendering**: `SkillTargeting.vue` draws them in `TEAM_ARROW_COLORS` (`useArrowLayer.ts`) beside skill arrows, sharing the toggle, geometry, and team view (which hides the enemy slot); `GridArrow` prefixes its marker id with the board id because SVG marker ids are document-wide and the Teams page renders several boards

If an artifact ever needs a side effect (a spawned unit, a capacity change), give skills a caster-agnostic source rather than extending this table.

## Skill Page Pipeline

Distinct from the runtime above: the `/skills` browser, the `SkillModal` popup, and the pre-rendered `/<code>/skill/<slug>` pages (one per language and hero, 16 × roster) render a hero's skill text, tag chips, and optional commentary. Body text and hero name follow the text locale; chips, labels, and roster text follow the chrome locale.

### Locale Files (`/src/locales/skill/<code>/`)

| File             | Written by               | Purpose                                                                             |
| ---------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `<slug>.json`    | `npm run import:skills`  | Per-hero skill text (shape below)                                                   |
| `_keywords.json` | `npm run import:skills`  | Glossary key → tooltip text for `[[label\|key]]` tokens                             |
| `_charms.json`   | `npm run import:charms`  | Seasonal charm text, rendered by `SkillCharmSection` ([SEASONAL.md](./SEASONAL.md)) |
| `index.ts`       | importer, non-en/zh only | Eager same-dir glob that bundles the directory as one lazy chunk                    |

The directory is prettier-ignored (compact importer output) and never hand-edited. Underscore files ride the chunk but `splitSkillDict` separates them at load time, so slug walks and the search index only see heroes; the SSG route walk skips them too.

```typescript
// src/lib/types/skill.ts: on-disk shape of <slug>.json
type SkillLocaleFile = {
  _hero?: { name: string } // feed's localized hero name
  _terms?: { ultimate: string; ex: string } // official slot-type labels
} & Partial<
  Record<
    SlotKey,
    {
      n?: string | null // skill name
      d: string[] // d[i] is the description for level i+1
      r?: { t: number; d: string }[] // EX refinement tiers, `ex` slot only
    }
  >
>
```

- **Slot order**: `SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening']` is both render order and the snippet slot contract
- **Loading**: en/zh are eagerly bundled (`loadSkillLocales`); other languages load through `loadSkillLocale(lang)`, promise-cached with a failed fetch evicted so the next call retries
- **Route warm-up**: `warmSkillLocale` is a global `beforeResolve` (not `beforeEnter`, which skips the globe menu's param-only navigation) that awaits the chunk before any `skill` route renders, since vite-ssg renders once without Suspense
- **Coverage**: The importer asserts every locale's slug set equals en's, so `hasSkillLocale(slug)` answers from en presence alone and gates `CharacterInfoIcons`, `SkillModal`, and `SkillReader.visibleSlug` against dead links

### Text Grammar (`/src/utils/textHighlight.ts`)

- `[[value]]` renders a highlight; `[[label|key]]` renders a glossary keyword whose tooltip resolves `key` in the language's `_keywords.json`; `<ATK>`-style tags render stat pills
- `HIGHLIGHT_RE`, `STAT_TAG_RE`, and `splitHighlightToken` are the single grammar, imported by `searchHighlight.ts` (strips tokens for the search corpus), `scripts/import-skills.ts`, and `vite.config.ts`
- Keyword spans sit in `v-html` output, so `SkillKeywordTooltip` delegates on the `SkillSections` article rather than binding per span

### Tag Overlay (`/src/data/character/<slug>.json`)

```jsonc
"tags": {
  "special-target": [{ "skill2": 1 }],
  "temp-buff":      [{ "skill2": 1 }, { "awakening": 1 }],
  "initial-energy-300": []          // empty: character-level only
}
```

- `useSkillTags(slug)` exposes `perLevel(slot, level)` and `perCharacter`; `SkillSections` shows the per-character union as a chip strip and each slot's union beside its heading, and an active chip hides levels without it
- Refinement rows (`r`) are not taggable and disappear under any active chip
- Labels resolve from `/src/locales/app/<tag>.json`; `useCharacterFilters` reads `Object.keys(c.tags)`, and `/skills?tag=<name>` seeds that filter
- The importer never touches `tags`; adding a tag is one locale file plus attachments

### Headings and Names (`/src/utils/skillLabels.ts`)

- `ultimate` / `ex` → `<_terms prefix>: <n>`; `skill2` / `skill3` → `n`; `mastery` / `awakening` → `n`. The app labels `ultimate`, `ex-skill`, `hero-focus`, `enhance-force` are fallbacks only, but stay the chrome-locale labels for search-result slot chips
- `heroDisplayName` reads `_hero.name` in the text locale, then the curated en name, then the slug; curated en/zh names (`/src/locales/character/`) stay on chrome surfaces and as search aliases
- Refinement tiers render below the level rows with an `R<tier>` badge (`SkillSection.vue`)

### Routes and Meta

- Route: `/:textLocale(<SKILL_LOCALE_CODES>)/skill/:name` in `/src/router/routes.ts`; `/skills` is the SPA index. `vite.config.ts` builds the SSG list by walking each locale directory and fails on a missing one
- `splitLocalePath` matches only `(en|zh)`, so a `/ko/...` prefix parses as unprefixed: the chrome store never pins to a non-app language, and the header toggle flips the chrome preference in place there instead of rewriting the URL
- SSG post-processing sets `<html lang>`, adds a `modulepreload` for the page's locale chunk on non-en/zh pages, and extracts the meta description from the first `<article>` (the `SkillSections` root); the rest of the browser stays `<article>`-free so that match is the skill text

### Commentary Snippets (`/src/content/skill/<slug>/`)

Optional `<HeroNameCamelCase>.<lang>.vue` (en/zh only) is picked up by a glob in `SkillSections`; resolution order is the text locale when it is an app locale, then the chrome locale, then en.

```vue
<SkillSnippets>
  <template #skill2>
    <SkillSnippet title-key="how-it-works">
      <p>Custom explanation...</p>
    </SkillSnippet>
  </template>
</SkillSnippets>
```

- Slot names are `SLOT_ORDER` keys; `useSnippetAnchors` provides one anchor per rendered section (`snippetKeys.ts`) and `SkillSnippets` teleports each filled slot into it. Without anchors (guide panels) the slots render inline in slot order
- `SkillSnippet` takes `title`, `title-key`, or `body-key`, resolving keys from `/src/locales/app/`
- Grid diagrams pair a `<Hero>.data.ts` with `<GridSnippet>`; the data's `character` map is keyed by roster slug and portraits come from `loadCharacterImages`, so data files import no images

### Browser and Search

- **URL as state**: `SkillsBrowser.vue` backs both `/skills` and every permalink; roster cells in `SkillsSelection` are `RouterLink`s to `/<linkLocale>/skill/<slug>`, where `linkLocale` is the page's text locale on a hero page and `effectiveSkillLocale` (saved globe preference, else app locale) on the index
- **SSG-safe data**: The browser calls `gameDataStore.initializeContentData()` so the roster and its crawlable links pre-render
- **Locale menu**: `SkillLocaleMenu` in the reader header and in `SkillModal` (`useModalSkillLocale`) switches the text language; the header en/中 toggle owns chrome only
- **Mobile**: At ≤768px (`TABLET_MAX_WIDTH`) the roster is a `BottomSheet`, open on the index and peeked on a hero page
- **Overlay**: `SkillSearchOverlay` mounts once at App root and teleports after mount (SSG carries only the triggers); ⌘K / Ctrl+K toggle it, `/` opens it unless focus is in a text field, `HeaderSearchTrigger` swaps from pill to icon below 921px, and ≥1220px (`SPLIT_MIN_WIDTH`) adds a detail pane. Escape is handled in capture phase and any route change closes it, so a select-mode handler (`useSearchOverlay().openSelect`, used by the arena roster) never outlives its page. Recents persist under `stargazer.recentHeroes`
- **Deep links**: Result rows link to `/<hit locale>/skill/<slug>#<slot>`, resolved by `SkillSection` ids and the router `scrollBehavior`

`useSkillSearch(query, appLang, textLang)` rules:

| Rule     | Behavior                                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------ |
| Corpus   | Every warm locale; the first non-empty query loads all missing chunks and a version tick re-runs the query as each lands |
| Names    | `_hero.name` per language plus curated en/zh aliases; ≥1 character matches names                                         |
| Deep     | ≥3 characters (≥2 for Han, kana, Hangul) adds skill names, descriptions, and charm text                                  |
| Priority | Text locale, then app locale, then table order; each hit records the locale it matched in and links there                |
| Dedup    | One hit per (slug, slot) at the lowest level; charm hits share one pseudo-slot; at most 3 hits per hero                  |
| Ranking  | Name-matched heroes first, then hit count, then curated name                                                             |
| Picker   | `matchCharacterNames` (on-grid `CharacterSelectionPalette`) matches warm locales only and never loads                    |

### Importer (`scripts/import-skills.ts`)

- Reads `<src-dir>/<feed>/skills.json` (default `../afkj-data-viewer/public/api`) or `<url-base>/<feed>/skills.json` for every `SKILL_LOCALES` row; the `feed` column maps nonstandard feed codes to the BCP-47 `code` used for directories and URLs
- Requires `_meta.terms` and `_meta.keywords` in each feed, and fails when locales disagree on hero set, slot set, or a keyword token lacks a glossary entry
- Read-only against character files; writes are diff-then-write, so an unchanged run is a no-op. Heroes absent from the feed and locale directories not in `SKILL_LOCALES` are warned, not failed
- Adding a language is one `SKILL_LOCALES` row plus a re-run; removing one is deleting the row and its directory

## Related Documentation

- [`/docs/architecture/skills/COMPANION.md`](./skills/COMPANION.md) - Companion spawning, links, and capacity
- [`/docs/architecture/skills/TARGETING.md`](./skills/TARGETING.md) - Distance, ring, and symmetry targeting helpers
- [`/docs/architecture/GRID.md`](./GRID.md) - Grid, transactions, and the synergy id band
- [`/docs/architecture/SEASONAL.md`](./SEASONAL.md) - Seasonal skills, artifacts, and charm text
- [`/docs/architecture/PRE_RENDERING.md`](./PRE_RENDERING.md) - SSG route generation and locale chunk warm-up
