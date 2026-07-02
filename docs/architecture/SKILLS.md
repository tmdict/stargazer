# Skill System

## Overview

The skill system enables characters to have unique abilities that activate when placed on the grid. Skills modify game rules, spawn companions, target enemies, and provide visual feedback through an extensible, lifecycle-managed architecture.

## Design Principles

1. **Separation of Concerns**: Skills don't directly modify UI - they change state that UI reacts to
2. **Team Awareness**: All tracking uses team context to prevent cross-team conflicts
3. **Atomic Operations**: Multi-step operations use transactions with rollback
4. **Clean Lifecycle**: Clear activation/deactivation with proper cleanup
5. **Extensibility**: New skills can be added without modifying core systems

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Components    │────▶│ Character Store  │────▶│  Characters     │
│                 │     │                  │     │                 │
│ GridCharacters  │     │ - Reactive state │     │ - Entities      │
│ DragDrop, etc.  │     │ - Actions        │     │ - Transactions  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
         │                                                │
         │                                                │
         │                                                │
         ▼                                                ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Skill Store    │────▶│  Skills          │────▶│    Grid         │
│                 │     │                  │     │                 │
│ - Color mods    │     │ - Skill Registry │     │ - Public props  │
│ - Reactive      │     │ - Lifecycle      │     │ - Spatial ops   │
└─────────────────┘     └──────────────────┘     └─────────────────┘

```

### Core Components

#### 1. Skill Interface (`/src/lib/skills/skill.ts`)

Skills are self-contained units that:

- Define their own activation/deactivation logic
- Can modify grid state, spawn companions, or add visual effects
- Receive a context object with all necessary dependencies
- Self-register with the skill registry on import

```typescript
interface Skill {
  id: string
  characterId: number
  colorModifier?: string // Border color for visual effects (main unit)
  companionImageModifier?: string // Custom image for companion units
  companionColorModifier?: string // Border color for companion units
  targetingColorModifier?: string // Arrow color for targeting skills
  companionRange?: number // Override range for companion units

  onActivate(context: SkillContext): void
  onDeactivate(context: SkillContext): void
  onUpdate?(context: SkillContext): void // Called on grid changes
}

interface SkillContext {
  grid: Grid
  hexId: number
  team: Team
  characterId: number
  skillManager: SkillManager
  lookups?: SkillLookups // injected data-store resolvers: { factionOf, classOf, ... }
}
```

#### 2. Skill Registry (`/src/lib/skills/registry.ts`)

The registry stores skills using a generic `SkillBase<Context>` interface to avoid circular dependencies with `SkillContext`. The `skill.ts` module provides typed wrappers that bind `SkillContext` to the generic functions.

```typescript
// registry.ts - generic interface, stores SkillBase<unknown>
interface SkillBase<Context = unknown> {
  id: string
  characterId: number
  onActivate: (context: Context) => void
  // ...
}

// skill.ts - concrete type and typed wrappers
type Skill = SkillBase<SkillContext>
registerSkill(skill: Skill)      // Typed wrapper
getCharacterSkill(id): Skill     // Typed wrapper
hasSkill(characterId)            // Direct re-export
hasCompanionSkill(characterId)   // Direct re-export
```

#### 3. SkillManager (`/src/lib/skills/skill.ts`)

The SkillManager tracks active skills and visual modifiers:

- **Team-aware tracking**: Uses composite keys (`characterId-team`) to support same character on different teams
- **Active skill registry**: Tracks which characters have active skills
- **Color modifier system**: Manages visual effects for characters, companions, and tiles
- **Lifecycle management**: Handles skill activation/deactivation with proper cleanup

Key methods:

- `activateCharacterSkill()` - Activates a skill with rollback on failure
- `deactivateCharacterSkill()` - Deactivates and cleans up
- `getColorModifiersByCharacterAndTeam()` - Returns character visual modifiers for UI
- `setTileColorModifier()` / `getTileColorModifier()` - Manages tile border colors
- `setTileFillModifier()` / `getTileFillModifier()` - Manages tile fill colors (an independent channel rendered as a tinted cell fill instead of a border)

#### 4. Characters Operations (`/src/lib/characters/`)

Modular operations that integrate skills with character actions:

```typescript
// Operations in separate files for better organization
executePlaceCharacter(grid, skillManager, hexId, characterId, team) // place.ts
executeRemoveCharacter(grid, skillManager, hexId) // remove.ts
executeSwapCharacters(grid, skillManager, fromHexId, toHexId) // swap.ts
executeMoveCharacter(grid, skillManager, fromHexId, toHexId, characterId) // move.ts
```

Features:

- Automatic skill activation when placing characters with skills
- Proper skill deactivation before character removal
- Cross-team movement handles skill state transitions
- Transaction pattern ensures atomicity

## Skill Categories

### Companion Skills

Spawn linked characters that share fate with their main unit:

- **Linked lifecycle**: Main and companion removed together
- **Team capacity**: Increases beyond standard limit
- **Visual differentiation**: Custom border colors or profile images
- **Range independence**: Companions can have different ranges
- **Multiple companions**: Support for spawning multiple companion units

See [`/docs/architecture/skills/COMPANION.md`](./skills/COMPANION.md) for implementation details.

### Targeting Skills

Automatically select and track enemy targets:

- **Unified API**: Composable targeting functions eliminate duplication
- **Dynamic recalculation**: Updates when characters move
- **Visual feedback**: Colored arrows instead of borders
- **Flexible patterns**: Furthest/closest, same/opposing team, spiral search
- **Performance optimized**: Efficient grid queries and early termination

See [`/docs/architecture/skills/TARGETING.md`](./skills/TARGETING.md) for implementation details.

### Tile Effect Skills

Highlight multiple tiles based on game state:

- **Tile modifiers**: Two channels per tile: a color border, or a tinted cell fill for skills that opt in with `fill`
- **Priority selection**: Find valid targets using tie-breaking rules
- **Dynamic updates**: Recalculate when board state changes
- **Layered rendering**: Skill borders always visible on top

## Adding New Skills

Most skills follow one of three reusable lifecycle patterns. Prefer the matching factory in `/src/lib/skills/utils/builders.ts`; it eliminates the activate/deactivate(/update) boilerplate.

Each skill file carries a short block comment above `registerSkill` describing its in-game behavior. That comment is the only documentation of the skill's effect; the skill object itself holds just `id` and `characterId` (no `name`/`description` fields).

### Pattern 1: arrow-based targeting (`createTargetingSkill`)

For skills that compute a target and draw an arrow (or build their own arrows for multi-target cases like Ravion / Aliceth):

```typescript
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

// What it does (gameplay behavior).
registerSkill(
  createTargetingSkill({
    id: 'my-skill',
    characterId: 123,
    color: '#hexcolor', // arrow color (becomes targetingColorModifier)
    arrowType: 'ally', // omit when calculateTarget builds its own arrows array
    calculateTarget: (ctx) =>
      findTarget(ctx, {
        targetTeam: ctx.team,
        excludeSelf: true,
        targetingMethod: TargetingMethod.FRONTMOST,
      }),
  }),
)
```

### Pattern 2: tile highlight (`createTileHighlightSkill`)

For skills that highlight a single tile and need previous-target cleanup on update:

```typescript
import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { rowScan, ScanDirection } from '../utils/ring'

// What it does (gameplay behavior).
registerSkill(
  createTileHighlightSkill({
    id: 'my-skill',
    characterId: 123,
    tileColor: '#hexcolor',
    // fill: true,  // optional: tint the target's cell fill instead of its border
    calculateTarget: (ctx) =>
      rowScan(ctx, { team: ctx.team, rowDirection: ScanDirection.REARMOST }),
  }),
)
```

### Pattern 3: companion units (`createCompanionSkill`)

For skills that spawn extra units (Phraesto's shadow, Lailah, Zanie's turrets). The factory owns the whole lifecycle: random free-tile placement, the team-capacity bump (`count` companions raise it by `count`), companion links, modifiers, rollback-and-throw on placement failure, and full teardown with capacity restore on deactivation:

```typescript
import { registerSkill } from '../registry'
import { createCompanionSkill } from '../utils/builders'

// What it does (gameplay behavior).
registerSkill(
  createCompanionSkill({
    id: 'my-skill',
    characterId: 123,
    count: 2, // companions to spawn (default 1); IDs are N * companionIdOffset + characterId
    colorModifier: '#hexcolor', // optional - main character border
    companionColorModifier: '#hexcolor', // optional - companion border
    companionImageModifier: 'image-name', // optional - companion profile image
    companionRange: 2, // optional - companion range override
  }),
)
```

### Pattern 4: custom lifecycle (multi-tile zones, etc.)

When no factory fits (multi-tile highlights, companion spawning), pass the skill object directly to `registerSkill`. Declare any tile color as a local module const so the activate/deactivate logic can reference it without reaching back into the registered object, and drive visuals through the SkillManager's `setTileColorModifier`/`setTileFillModifier` (or `paintTiles` for a multi-tile set). Both paint channels refcount per (tile, color), so independent skills can paint the same color on a shared tile and one skill's cleanup never clears another's; each remove call must still mirror its add. Kulu paints its cosmetic demolition zone this way, leaving tile state untouched so the tiles stay placeable:

```typescript
import { registerSkill } from '../registry'
import { type SkillContext } from '../skill'

const TILE_COLOR = '#hexcolor'

// What it does (gameplay behavior).
registerSkill({
  id: 'my-skill',
  characterId: 123,

  onActivate(context: SkillContext) {
    const { grid, team, characterId, skillManager } = context
    // Paint tiles, spawn companions, etc.
    // Use skillManager.setTileColorModifier(hexId, TILE_COLOR) for tiles
  },

  onDeactivate(context: SkillContext) {
    // Use skillManager.removeTileColorModifier(hexId, TILE_COLOR)
  },

  onUpdate(context: SkillContext) {
    // Optional - recalculate targets, update visuals, etc.
  },
})
```

### Composing tile highlights onto another skill (`withTilePaint`)

The registry holds one skill per character, so a character that already uses a factory (e.g. a companion skill) can't register a second skill just to highlight tiles. `withTilePaint(baseSkill, calculate)` wraps a base skill and runs a multi-tile paint pass after the base's own hooks. `calculate(ctx)` returns the tiles and colors for the current grid (`{ hexId, color, fill? }[]`, where `fill: true` tints the cell instead of its border); the wrapper diffs against the previously painted set (tracked per characterId-team) so stale colors clear before new ones apply, and clears all of them on deactivate. Reach for it when a highlight spans several tiles with a per-call color; unlike `createTileHighlightSkill` (single tile). Elijah-Lailah composes it onto its companion skill to outline the allies sandwiched between the twins.

```typescript
import { createCompanionSkill, withTilePaint } from '../utils/builders'

registerSkill(
  withTilePaint(
    createCompanionSkill({
      /* ... */
    }),
    (ctx) => calculateTiles(ctx), // returns { hexId, color }[]
  ),
)
```

When `calculate` needs a data-store fact about a unit, read it from `ctx.lookups`: `ctx.lookups?.factionOf?.(id)` for faction (companion resolves to its main character, phantimal to its seasonal faction), `ctx.lookups?.classOf?.(id)` for class. The resolvers are injected as one `SkillLookups` bag because that data lives outside the pure skill lib, so a new fact is added in one place rather than threaded through every context (Himmel uses `classOf` to highlight one tank, one mage, and one support among its same-team neighbours).

### Connecting hexes with a line (`withSkillLine`)

`withSkillLine(baseSkill, calculate)` is the line analog of `withTilePaint`: `calculate(ctx)` returns straight connection lines (`{ fromHexId, toHexId, color }[]`) that `SkillTargeting` draws border-to-border between the hex icons; same stroke width as targeting arrows but straight, no arrowhead, and self-colored (so it renders for any skill, not just targeting ones). Stack it with `withTilePaint` to do both (Elijah-Lailah draws a line between the twins and outlines the allies between them). Both visuals, like the tile borders and arrows, only show while `showSkills` is on.

Skills placed in `/src/lib/skills/characters/` are automatically imported via Vite's `import.meta.glob()` when `skill.ts` is loaded, triggering their self-registration.

Skills must handle:

- Activation failures (rollback state)
- Clean deactivation
- Team changes
- Edge cases

## Skill Page Pipeline

Distinct from the in-game runtime above: this is the documentation surface, the `/skills` browser page, the `SkillModal` popup, and the per-hero SSG pages at `/<lang>/skill/<slug>`, that renders a hero's skill text, filter chips, and optional commentary.

Skill text is served in every language the upstream feed publishes (`SKILL_LOCALES` in `/src/lib/types/i18n.ts`, 16 today) while the site chrome stays en/zh: two locale axes, `SkillLocale` for the body text and hero name, `AppLocale` for labels and chips. The URL prefix is the skill-text language; a globe dropdown (`SkillLocaleMenu`) on the reader header and in the modal switches it, while the header en/中 toggle keeps owning the chrome.

### Two sources of truth

- **`/src/data/character/<slug>.json`**: hand-curated. Owns roster membership and a `tags` overlay (filter metadata).
- **`/src/locales/skill/<code>/<slug>.json`**: auto-generated by `npm run import:skills`, one dir per `SKILL_LOCALES` code. Owns per-language skill names, per-level descriptions, the feed's localized hero name (`_hero`), and the game's official slot-type labels (`_terms`: "Ultimate" / "Exclusive Equipment" in the file's language). Never hand-edited (the dir is also prettier-ignored so the importer's compact output is stable).

en/zh are eagerly bundled (the search index, guide panels, and the en fallback read them synchronously); every other language is **one lazy chunk per locale**, produced by an importer-emitted `index.ts` in each dir and loaded via `loadSkillLocale(lang)` (promise-cached; the `warmSkillLocale` global `beforeResolve` guard warms it before any skill route renders, see [PRE_RENDERING.md](./PRE_RENDERING.md)).

SSG routes are generated at build time by walking the locale dirs: every `(language, hero)` file produces a `/<code>/skill/<slug>` page (~1.9k). Coverage across languages is asserted by the importer (every locale's slug set must equal en's, or the import fails), so at runtime `hasSkillLocale(slug)` answers from en presence alone and gates the surfaces where a missing locale would otherwise surface a dead link; `SkillReader`'s `visibleSlug` computed and the info-icon button in `CharacterInfoIcons`. The importer currently covers the full roster, so the guard is dormant in practice; it exists for the transient state where a new character JSON has been added but `npm run import:skills` hasn't been re-run yet.

### Locale file contract

Slot keys and on-disk shape are defined in `/src/lib/types/skill.ts` and are the single source of truth for both renderer and importer:

```typescript
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const
export type SlotKey = (typeof SLOT_ORDER)[number]

export interface SkillRefineEntry {
  t: number // tier; 2 or 4 in current data
  d: string // pre-rendered body text
}

export interface SkillLocaleSlot {
  n?: string | null // omitted for mastery/awakening in en/zh files only (those names live in app locales); other locales carry it
  d: string[] // d[i] is description for level i+1
  r?: SkillRefineEntry[] // EX refinement tiers (currently only on `ex`)
}
// `_hero` is the feed's localized hero display name, read on skill pages for
// languages the curated character locales (en/zh) cannot cover.
export type SkillLocaleFile = {
  _hero?: { name: string }
} & Partial<Record<SlotKey, SkillLocaleSlot>>
```

Description encoding: `[[…]]` wraps numeric/keyword highlights; `<TAG>` wraps stat-tag pills (`<ATK>`, `<HP>`). Both are rendered by `utils/textHighlight.ts`.

EX refinement tiers (`r`) only appear on the `ex` slot when the source data has them (≈99% of heroes for tier 2, ≈98% for tier 4 in current AFKJ data). Tier 2 is the class-shared Rivalry Skill unlocked at EX +27; tier 4 is the new-attribute introduction at EX +29, rendered via the localized "Lvl. N Refinement" template. They render as additional rows below the regular levels with a `REFINE N` badge in `SkillSection.vue`. Refinement tiers are not taggable; the `tags` overlay only attaches to numeric level rows.

### Tag overlay

`tags` on a character is a map keyed by tag name; each value is an array of `{slot: level}` attachments. An empty array means the tag is character-level only.

```jsonc
"tags": {
  "special-target":     [{ "skill2": 1 }],
  "temp-buff":          [{ "skill2": 1 }, { "awakening": 1 }],
  "initial-energy-300": []
}
```

`useSkillTags(slug)` exposes `perLevel(slot, level)` and `perCharacter`. `SkillSections` renders the per-character union as a chip strip at the top, and per-section chips as the union across that slot's levels. The character-selection filter reads `Object.keys(char.tags)` directly for cross-hero filtering; no composable needed.

Tag display labels resolve through `/src/locales/app/<tag>.json`. Adding a new tag means adding that locale file plus the attachments to the relevant character JSONs.

### Render pipeline

- **`SkillSections.vue`** is the canonical wrapper used by both `SkillReader` (the left panel of the shared `SkillsBrowser`) and `SkillModal`. It owns the chip filter state, composes section headings, and provides the snippet teleport anchors. Its root is `<article>` so SSG meta extraction (`vite.config.ts`) can pull the description: the browser keeps its other column free of `<article>` so the first match stays the skill text.
- **`SkillSection.vue`** renders one slot's heading + per-level descriptions. A level is shown if any of its tags is in the active chip set (empty filter shows all).
- **Heading composition** (per `SLOT_ORDER`):
  - `ultimate` / `ex` → `<prefix>: <name>` (prefix from app locale: `ultimate`, `ex-skill`)
  - `skill2` / `skill3` → just `<name>`
  - `mastery` / `awakening` → `n` (the invariant in-game skill name; the `hero-focus`/`enhance-force` app labels remain as fallbacks only)
- **Label vs text locale**: skill headings are fully content-language (names from `n`, ultimate/ex prefixes from the file's `_terms`, the game's official terms); chips, tag labels, and search-result slot labels render in the chrome locale (`AppLocale`)

### Per-hero commentary

Most heroes are covered entirely by the locale file. When a hero needs extra material, a mechanics explanation, a worked example, a grid visualization, drop an optional file at `/src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue` (one per language). It is picked up by file-name convention; no registration step.

Commentary is authored against a fixed set of "slots" (the same `SLOT_ORDER` as the locale file) so each block lands next to the skill it explains. The wrapper component is `<SkillSnippets>`, with one named slot per skill section:

```vue
<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>Custom explanation...</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
```

`<SkillSnippet>` is the styled callout box; `title` / `title-key` / `body-key` props let it inline copy or pull shared boilerplate from `/src/locales/app/<key>.json`. Grid visualizations co-locate a `<HeroNameCamelCase>.data.ts` alongside the snippet and render via `<GridSnippet>`.

Under the hood, `<SkillSections>` reserves an anchor element after each rendered skill section and provides the anchor map; `<SkillSnippets>` reads it and moves each filled slot into the matching anchor at render time. The slot keys and the section order are therefore the contract; adding a new slot key is a one-line change in `src/lib/types/skill.ts` that the snippet system inherits automatically.

### Skill browser

One layout, `SkillsBrowser.vue`, backs both the `/skills` index (SPA) and every `/<lang>/skill/<slug>` permalink (SSG). Left column `SkillReader` shows the active hero's `SkillSections` (or an empty prompt on `/skills`); right column `SkillsSelection` is the searchable, filterable character grid.

The URL is the single source of truth; there is no selection store. Each character in the grid is a `<RouterLink>` to `/<textLocale>/skill/<slug>`, so picking a hero is a navigation, not local state. Roster links keep the current text-locale prefix (browsing hero to hero never loses the reading language); on the `/skills` index the prefix is `effectiveSkillLocale` (saved globe pref, else app locale). Search-result links are WYSIWYG instead: each result links to the locale of its matched hit. On a permalink page the left column reads its hero from the route param and that hero is highlighted in the grid; on `/skills` the left column stays empty until the first click navigates into a permalink.

Because the permalink pages are pre-rendered, `SkillsBrowser` loads its data through `gameDataStore.initializeContentData()` (SSR-safe, unlike the client-only `initializeData`), so the full grid, and its crawlable inter-page links, bakes into the static HTML and hydrates without a mismatch. Chrome locale stays URL-authoritative for en/zh prefixes: `App.vue` syncs the i18n store from the path (`splitLocalePath`), and the language toggle (`useLocaleToggle`) navigates to the sibling-locale URL on `/{en,zh}/...` routes instead of flipping global state. Non-en/zh prefixes parse as unprefixed, so on those pages the toggle flips the chrome preference in place and the globe menu owns the content language.

On mobile (≤768px) the roster column becomes a **pull-up bottom sheet** over the reader via the shared `BottomSheet` component (`components/ui/BottomSheet.vue`, backed by `useBottomSheet`): the layout is CSS-driven so the SSG markup hydrates without a mismatch, and the composable adds the drag once mounted (touch or mouse). It opens on the empty `/skills` index and stays peeked on a hero page (so it doesn't cover the skill content); when expanded, a tap-scrim behind it collapses it on tap. The grid page (`HomeView`) uses the same `BottomSheet`, so the two roster sheets are identical by construction; `SkillsSelection` owns its in-sheet fill/scroll, just as the grid's `TabView` roster does.

`useSkillSearch(query, appLang, textLang)` searches **all 16 locales**. It builds an in-memory per-language index lazily over whatever corpora are warm: en/zh are always warm (eager bundle, no extra cost); the first non-empty query background-loads every missing locale chunk, and a reactive tick re-runs the open query as each arrives, so results refine live. Match priority is the active text locale, then the app locale, then the rest, the first hit per hero decides both the shown snippet and the result's link locale (WYSIWYG). Exotic hero names index from `_hero.name`. Matching rules: ≥1 char matches hero name only; ≥3 chars (≥2 for CJK) adds skill names + descriptions. At most one hit per (slug, slot), multiple-level matches collapse to the lowest level. Results capped at 3 hits per hero, ordered by hit count. `matchCharacterNames` (the on-grid picker) matches warm locales only and never triggers loads; chunk-load failures are soft (the language just never joins the index).

### Importer

`npm run import:skills` (`scripts/import-skills.ts`) reads one bulk feed per language in `SKILL_LOCALES` (mapping nonstandard feed codes like `kr`/`jp`/`tw` to the lowercase BCP-47 dir names `ko`/`ja`/`zh-tw`), walks `/src/data/character/*.json`, and writes `/src/locales/skill/<code>/<slug>.json` plus a per-dir `index.ts` chunk module for the non-en/zh locales. Per-locale source path: `<src-dir>/<feed>/skills.json` (local) or `<url-base>/<feed>/skills.json` (remote); the default `--src-dir` is the sibling afkj-data-viewer checkout's `static/api`. It emits the trimmed feed hero name as `_hero.name`, the official slot-type labels from the feed's `_meta.terms` as `_terms` (requiring their presence: a feed without them predates the producer's terms export), and `n` for every slot in every locale; it **asserts uniform coverage** (every locale's slug set must equal en's, or the run fails; hreflang and `hasSkillLocale` depend on it), warns when the feed's en name diverges from the curated character locale, and warns about locale dirs on disk that are no longer in `SKILL_LOCALES`. Read-only against character files (hand-curated `tags` are never touched) and idempotent (diff-then-write; the dir is prettier-ignored). Heroes missing from the feed entirely are reported, not failed. Adding a language is one `SKILL_LOCALES` row + a re-run; removing one is deleting the row and its dir.
