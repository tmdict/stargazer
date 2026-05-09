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

## Adding Skill Documentation

To add documentation pages for a skill:

1. **Create a skill directory** at `/src/content/skill/{skill-name}/` with:
   - `SkillName.en.vue` - English documentation content
   - `SkillName.zh.vue` - Chinese documentation content
   - `SkillName.data.ts` - (Optional) Grid visualization data and images for displaying grid snippets on the skill page

That's it — `DOCUMENTED_SKILLS` in `/src/lib/types/skills.ts` is automatically derived from the `/src/content/skill/` directory structure at build time via `import.meta.glob`. No manual list updates needed.
