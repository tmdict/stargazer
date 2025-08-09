# Skills

## Overview

The skill system enables characters to have unique abilities that activate when placed on the grid. Skills can modify game rules, spawn companion characters, add visual effects, and more. The system is designed to be extensible while maintaining clean separation from core game mechanics.

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
  colorModifier?: string // Border color for main unit
  companionColorModifier?: string // Border color for companion units
  companionRange?: number // Override range for companion units

  onActivate(context: SkillContext): void
  onDeactivate(context: SkillContext): void
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
- **Color modifier system**: Manages visual effects for characters and companions
- **Lifecycle management**: Handles skill activation/deactivation with proper cleanup

Key methods:

- `activateCharacterSkill()` - Activates a skill with rollback on failure
- `deactivateCharacterSkill()` - Deactivates and cleans up
- `getColorModifiersByCharacterAndTeam()` - Returns visual modifiers for UI

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

### Skill-specific Systems

#### Companion System

Companions are linked characters that share fate with their main character:

- **ID Convention**: Companions use characterId + 10000 (e.g., Phraesto 50 → companion 10050)
- **Team-aware linking**: Companion links stored as `mainId-team` → Set of companion IDs
- **Linked removal**: Removing either main or companion removes both
- **Movement rules**: Companions can move within team but not cross teams
- **Range overrides**: Skills can define `companionRange` to override default range for companions

Grid enhancements:

- `isCompanionId()` - Check if character is a companion
- `getCompanions(mainId, team?)` - Get companions for a character
- `addCompanionLink()` / `removeCompanionLink()` - Manage links
- `findCharacterHex(characterId, team?)` - Team-aware character lookup

## Implemented Skills

### Phraesto - Shadow Companion

**Character ID**: 50  
**Type**: Companion Spawning

**Behavior**:

1. When placed, spawns a shadow companion on a random allied tile
2. Increases team capacity by 1 (5 → 6)
3. Main Phraesto has white border (`#ffffff`)
4. Shadow companion has red border (`#c83232`)
5. If either is removed, both are removed
6. Companions can move within team but cannot cross teams
7. Skill deactivates/reactivates on team changes

**Implementation**: `/src/lib/skills/phraesto.ts`

### Elijah & Lailah - Twins

**Character ID**: 68  
**Type**: Companion Spawning with Range Override

**Behavior**:

1. When placed, spawns Lailah companion on a random allied tile
2. Increases team capacity by 1 (5 → 6)
3. Elijah has light blue border (`#78b5b2`)
4. Lailah has light pink border (`#e47d75`)
5. Lailah has range of 1 (overrides Elijah's range of 6)
6. If either twin is removed, both are removed
7. Skill deactivates/reactivates on team changes

**Implementation**: `/src/lib/skills/elijah-lailah.ts`

## Adding New Skills

To add a new skill:

1. **Create skill file** in `/src/lib/skills/`:

```typescript
export const mySkill: Skill = {
  id: 'my-skill',
  characterId: 123,
  name: 'Skill Name',
  description: 'What it does',
  colorModifier: '#hexcolor', // optional - main unit color
  companionColorModifier: '#hexcolor', // optional - companion color
  companionRange: 2, // optional - override companion range

  onActivate(context) {
    const { grid, team, characterId, skillManager } = context

    // Apply color to main character if defined
    if (this.colorModifier) {
      skillManager.addCharacterColorModifier(characterId, team, this.colorModifier)
    }

    // Activation logic
  },

  onDeactivate(context) {
    const { skillManager, characterId, team } = context

    // Remove color modifier
    skillManager.removeCharacterColorModifier(characterId, team)

    // Cleanup logic
  },
}
```

2. **Register in skill registry** (`/src/lib/skill.ts`):

```typescript
import { mySkill } from './skills/mySkill'

const skillRegistry = new Map<number, Skill>([
  [phraestoSkill.characterId, phraestoSkill],
  [elijahLailahSkill.characterId, elijahLailahSkill],
  [mySkill.characterId, mySkill], // Add here
])
```

3. **Test thoroughly** - Skills must handle:
   - Activation failures (rollback state)
   - Clean deactivation
   - Team changes
   - Edge cases

## Related Documentation

- [`/docs/architecture/GRID.md`](./GRID.md) - Grid & character management system
