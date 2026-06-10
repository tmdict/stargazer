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
  name: string
  description: string
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
- `claimTileState()` / `releaseTileState()` - Saves and restores tile states altered by skills. Multiple skills can claim the same tile (e.g. both teams' Kulu zones overlap on the middle tiles); the original state is captured at first claim and the tile is restored only when the last claimant releases

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

- **Tile modifiers**: Color borders on affected tiles
- **Priority selection**: Find valid targets using tie-breaking rules
- **Dynamic updates**: Recalculate when board state changes
- **Layered rendering**: Skill borders always visible on top

## Adding New Skills

Most skills follow one of two reusable lifecycle patterns. Prefer the matching factory in `/src/lib/skills/utils/builders.ts` — it eliminates the activate/deactivate/update boilerplate and only takes a `calculateTarget` callback.

### Pattern 1: arrow-based targeting (`createTargetingSkill`)

For skills that compute a target and draw an arrow (or build their own arrows for multi-target cases like Ravion / Aliceth):

```typescript
import { registerSkill } from '../registry'
import { createTargetingSkill } from '../utils/builders'
import { findTarget, TargetingMethod } from '../utils/distance'

registerSkill(
  createTargetingSkill({
    id: 'my-skill',
    characterId: 123,
    name: 'Skill Name',
    description: 'What it does',
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
import { rowScan, RowScanDirection } from '../utils/ring'

registerSkill(
  createTileHighlightSkill({
    id: 'my-skill',
    characterId: 123,
    name: 'Skill Name',
    description: 'What it does',
    tileColor: '#hexcolor',
    calculateTarget: (ctx) => rowScan(ctx, ctx.team, { direction: RowScanDirection.REARMOST }),
  }),
)
```

### Pattern 3: custom lifecycle (companions, multi-tile zones, etc.)

When neither factory fits — companion spawning, multi-tile state changes, multi-tile highlights — pass the skill object directly to `registerSkill`. Declare any tile color as a local module const so the activate/deactivate logic can reference it without reaching back into the registered object:

```typescript
import { registerSkill } from '../registry'
import { type SkillContext } from '../skill'

const TILE_COLOR = '#hexcolor'

registerSkill({
  id: 'my-skill',
  characterId: 123,
  name: 'Skill Name',
  description: 'What it does',
  colorModifier: '#hexcolor', // optional - character border
  companionImageModifier: 'image-name', // optional - companion profile image
  companionColorModifier: '#hexcolor', // optional - companion border
  companionRange: 2, // optional - companion range override

  onActivate(context: SkillContext) {
    const { grid, team, characterId, skillManager } = context
    // Spawn companions, modify tiles, etc.
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

Skills placed in `/src/lib/skills/characters/` are automatically imported via Vite's `import.meta.glob()` when `skill.ts` is loaded, triggering their self-registration.

2. **Test thoroughly** - Skills must handle:
   - Activation failures (rollback state)
   - Clean deactivation
   - Team changes
   - Edge cases

## Skill Page Pipeline

Distinct from the in-game runtime above: this is the documentation surface — the `/skills` browser page, the `SkillModal` popup, and the per-hero SSG pages at `/{en,zh}/skill/<slug>` — that renders a hero's skill text, filter chips, and optional commentary.

### Two sources of truth

- **`/src/data/character/<slug>.json`** — hand-curated. Owns roster membership and a `tags` overlay (filter metadata).
- **`/src/locales/skill/{en,zh}/<slug>.json`** — auto-generated by `npm run import:skills`. Owns per-language skill names and per-level descriptions. Never hand-edited.

SSG routes are generated at build time by walking `src/locales/skill/en/`: every locale file produces an `/{en,zh}/skill/<slug>` page. At runtime, a single helper `hasSkillLocale(slug)` (`/src/utils/dataLoader.ts`) tests the same condition and gates the surfaces where a missing locale would otherwise surface a dead link — `SkillReader`'s `visibleSlug` computed, the info-icon button in `CharacterInfoIcons`, and the route validator in `SkillView`. The importer currently covers the full roster, so the guard is dormant in practice; it exists for the transient state where a new character JSON has been added but `npm run import:skills` hasn't been re-run yet.

### Locale file contract

Slot keys and on-disk shape are defined in `/src/lib/types/skill.ts` and are the single source of truth for both renderer and importer:

```typescript
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const
export type SlotKey = (typeof SLOT_ORDER)[number]

export interface SkillRefineEntry {
  t: number // tier — 2 or 4 in current data
  d: string // pre-rendered body text
}

export interface SkillLocaleSlot {
  n?: string | null // omitted for mastery/awakening (invariant names live in app locales)
  d: string[] // d[i] is description for level i+1
  r?: SkillRefineEntry[] // EX refinement tiers (currently only on `ex`)
}
export type SkillLocaleFile = Partial<Record<SlotKey, SkillLocaleSlot>>
```

Description encoding: `[[…]]` wraps numeric/keyword highlights; `<TAG>` wraps stat-tag pills (`<ATK>`, `<HP>`). Both are rendered by `utils/textHighlight.ts`.

EX refinement tiers (`r`) only appear on the `ex` slot when the source data has them (≈99% of heroes for tier 2, ≈98% for tier 4 in current AFKJ data). Tier 2 is the class-shared Rivalry Skill unlocked at EX +27; tier 4 is the new-attribute introduction at EX +29, rendered via the localized "Lvl. N Refinement" template. They render as additional rows below the regular levels with a `REFINE N` badge in `SkillSection.vue`. Refinement tiers are not taggable — the `tags` overlay only attaches to numeric level rows.

### Tag overlay

`tags` on a character is a map keyed by tag name; each value is an array of `{slot: level}` attachments. An empty array means the tag is character-level only.

```jsonc
"tags": {
  "special-target":     [{ "skill2": 1 }],
  "temp-buff":          [{ "skill2": 1 }, { "awakening": 1 }],
  "initial-energy-300": []
}
```

`useSkillTags(slug)` exposes `perLevel(slot, level)` and `perCharacter`. `SkillSections` renders the per-character union as a chip strip at the top, and per-section chips as the union across that slot's levels. The character-selection filter reads `Object.keys(char.tags)` directly for cross-hero filtering — no composable needed.

Tag display labels resolve through `/src/locales/app/<tag>.json`. Adding a new tag means adding that locale file plus the attachments to the relevant character JSONs.

### Render pipeline

- **`SkillSections.vue`** is the canonical wrapper used by both `SkillReader` (the left panel of the shared `SkillsBrowser`) and `SkillModal`. It owns the chip filter state, composes section headings, and provides the snippet teleport anchors. Its root is `<article>` so SSG meta extraction (`vite.config.ts`) can pull the description — the browser keeps its other column free of `<article>` so the first match stays the skill text.
- **`SkillSection.vue`** renders one slot's heading + per-level descriptions. A level is shown if any of its tags is in the active chip set (empty filter shows all).
- **Heading composition** (per `SLOT_ORDER`):
  - `ultimate` / `ex` → `<prefix>: <name>` (prefix from app locale: `ultimate`, `ex-skill`)
  - `skill2` / `skill3` → just `<name>`
  - `mastery` / `awakening` → invariant name from app locale (`hero-focus`, `enhance-force`); no per-hero name is read

### Per-hero commentary

Most heroes are covered entirely by the locale file. When a hero needs extra material — a mechanics explanation, a worked example, a grid visualization — drop an optional file at `/src/content/skill/<slug>/<HeroNameCamelCase>.<lang>.vue` (one per language). It is picked up by file-name convention; no registration step.

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

Under the hood, `<SkillSections>` reserves an anchor element after each rendered skill section and provides the anchor map; `<SkillSnippets>` reads it and moves each filled slot into the matching anchor at render time. The slot keys and the section order are therefore the contract — adding a new slot key is a one-line change in `src/lib/types/skill.ts` that the snippet system inherits automatically.

### Skill browser

One layout — `SkillsBrowser.vue` — backs both the `/skills` index (SPA) and every `/{en,zh}/skill/<slug>` permalink (SSG). Left column `SkillReader` shows the active hero's `SkillSections` (or an empty prompt on `/skills`); right column `SkillsSelection` is the searchable, filterable character grid.

The URL is the single source of truth — there is no selection store. Each character in the grid (and each search result) is a `<RouterLink>` to `/{lang}/skill/<slug>`, so picking a hero is a navigation, not local state. On a permalink page the left column reads its hero from the route param and that hero is highlighted in the grid; on `/skills` the left column stays empty until the first click navigates into a permalink.

Because the permalink pages are pre-rendered, `SkillsBrowser` loads its data through `gameDataStore.initializeContentData()` (SSR-safe, unlike the client-only `initializeData`), so the full grid — and its crawlable inter-page links — bakes into the static HTML and hydrates without a mismatch. Locale is URL-authoritative: `App.vue` syncs the i18n store from the path (`splitLocalePath`), and the language toggle (`useLocaleToggle`) navigates to the sibling-locale URL on `/{en,zh}/...` routes instead of flipping global state.

On mobile (≤768px) the roster column becomes a **pull-up bottom sheet** over the reader via the shared `BottomSheet` component (`components/ui/BottomSheet.vue`, backed by `useBottomSheet`): the layout is CSS-driven so the SSG markup hydrates without a mismatch, and the composable adds the drag once mounted (touch or mouse). It opens on the empty `/skills` index and stays peeked on a hero page (so it doesn't cover the skill content); when expanded, a tap-scrim behind it collapses it on tap. The grid page (`HomeView`) uses the same `BottomSheet`, so the two roster sheets are identical by construction; `SkillsSelection` owns its in-sheet fill/scroll, just as `TabNavigation` does on the grid.

`useSkillSearch(query, lang)` builds an in-memory per-language index lazily on first query, sourced from `loadCharacterLocales()` and `loadSkillLocales()[lang]` (both already loaded by the app, so no extra bundle cost). Matching rules: ≥1 char matches hero name only; ≥3 chars adds skill names + descriptions. At most one hit per (slug, slot) — multiple-level matches collapse to the lowest level. Results capped at 3 hits per hero, ordered by hit count.

### Importer

`npm run import:skills` (`scripts/import-skills.ts`) reads N per-locale bulk feeds (one per language Stargazer renders — currently `en` + `zh`, hardcoded as the importer's `LOCALES` constant), walks `/src/data/character/*.json`, and writes only `/src/locales/skill/{en,zh}/<slug>.json`. Per-locale source path: `<src-dir>/<lang>/skills.json` (local) or `<url-base>/<lang>/skills.json` (remote). Default `--src-dir` is `./api`; override with `--src-dir <PATH>` or `--url-base <URL>`. The producer (afkj-data-viewer) emits the same schema to `static/api/<locale>/skills.json` — pointing `--src-dir` at that directory wires the integration. Read-only against character files (hand-curated `tags` are never touched) and idempotent (diff-then-write). Heroes missing from the feed are reported, not failed.
