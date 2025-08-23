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
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Components    │────▶│ Character Store  │────▶│  Character  │
│                 │     │                  │     │   Manager   │
│ GridCharacters  │     │ - Reactive state │     │             │
│ DragDrop, etc.  │     │ - Actions        │     │ Functional  │
└─────────────────┘     └──────────────────┘     │    API      │
         │                                       └──────┬──────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Skill Store    │────▶│  SkillManager    │────▶│    Grid     │
│                 │     │                  │     │             │
│ - Color mods    │     │ - Active skills  │     │ - State     │
│ - Reactive      │     │ - Lifecycle      │     │ - Trans-    │
└─────────────────┘     └──────────────────┘     │   actions   │
                                                 └─────────────┘
```

### Core Components

#### 1. Skill Interface (`/src/lib/skill.ts`)

Skills are self-contained units that:

- Define their own activation/deactivation logic
- Can modify grid state, spawn companions, or add visual effects
- Receive a context object with all necessary dependencies

```typescript
interface Skill {
  id: string
  characterId: number
  name: string
  description: string
  colorModifier?: string // Border color for visual effects
  targetingColorModifier?: string // Arrow color for targeting skills
  companionColorModifier?: string // Border color for companions
  tileColorModifier?: string // Tile border color for tile effects
  companionRange?: number // Override range for companions

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

#### 2. SkillManager (`/src/lib/skill.ts`)

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

#### 3. Character Manager (`/src/lib/character.ts`)

Provides a functional API layer that integrates skills with character operations:

```typescript
// All character operations now trigger appropriate skill lifecycle
placeCharacter(grid, skillManager, hexId, characterId, team)
removeCharacter(grid, skillManager, hexId)
swapCharacters(grid, skillManager, fromHexId, toHexId)
moveCharacter(grid, skillManager, fromHexId, toHexId, characterId)
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
- **Visual differentiation**: Custom border colors
- **Range independence**: Companions can have different ranges

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

To add a new skill:

1. **Create skill file** in `/src/lib/skills/`:

```typescript
export const mySkill: Skill = {
  id: 'my-skill',
  characterId: 123,
  name: 'Skill Name',
  description: 'What it does',
  colorModifier: '#hexcolor', // optional - character border
  targetingColorModifier: '#hexcolor', // optional - arrow color
  companionColorModifier: '#hexcolor', // optional - companion border
  tileColorModifier: '#hexcolor', // optional - tile border
  companionRange: 2, // optional - companion range override

  onActivate(context) {
    const { grid, team, characterId, skillManager } = context

    // Activation logic - spawn companions, set targets, etc.
    // Use skillManager.setTileColorModifier(hexId, color) for tiles
  },

  onDeactivate(context) {
    // Cleanup logic - remove companions, clear targets, etc.
    // Use skillManager.removeTileColorModifier(hexId) for tiles
  },

  onUpdate(context) {
    // Optional - recalculate targets, update visuals, etc.
  },
}
```

2. **Register in skill registry** (`/src/lib/skill.ts`):

```typescript
import { mySkill } from './skills/mySkill'

const skillRegistry = new Map<number, Skill>([
  // Companion skills
  [phraestoSkill.characterId, phraestoSkill],
  // ...
  // Targeting skills
  [silvinaSkill.characterId, silvinaSkill],
  // ...
  // Tile effect skills
  [reinierSkill.characterId, reinierSkill],
  // ...
  // Add new skills here
  [mySkill.characterId, mySkill],
])
```

3. **Test thoroughly** - Skills must handle:
   - Activation failures (rollback state)
   - Clean deactivation
   - Team changes
   - Edge cases

## Adding Skill Documentation

To add documentation pages for a skill:

1. **Create content files** in `/src/content/skills/`:
   - `SkillName.en.vue` - English documentation content
   - `SkillName.zh.vue` - Chinese documentation content  
   - `SkillName.data.ts` - (Optional) Grid visualization data and images for displaying grid snippets on the skill page

2. **Update DOCUMENTED_SKILLS** in `/src/lib/skill.ts`:
   - Add the skill name to the `DOCUMENTED_SKILLS` array (near the skillRegistry):
   ```typescript
   // List of skills with documentation pages
   // Update this when adding new skill documentation
   export const DOCUMENTED_SKILLS = [
     'silvina',
     'nara', 
     'vala',
     'reinier',
     'dunlingr',
     'newskill',  // Add your new skill here
   ] as const
   ```

This single update ensures:
- The skill appears in SkillsSelection.vue automatically
- Skill.vue properly normalizes the skill name for routing
- vite.config.ts includes it for static site generation
- All skill documentation references use this single source of truth

## Performance Considerations

- **Lazy activation**: Skills only initialize when characters placed
- **Transaction atomicity**: Multi-step operations rollback on failure
- **Reactive updates**: Vue integration for efficient rendering
- **Memory efficiency**: Cleanup on deactivation prevents leaks

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Grid & character management system
- [`/docs/architecture/skills/COMPANION.md`](./skills/COMPANION.md) - Companion skill implementation
- [`/docs/architecture/skills/TARGETING.md`](./skills/TARGETING.md) - Targeting skill implementation
