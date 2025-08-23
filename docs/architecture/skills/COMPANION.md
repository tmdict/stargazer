# Companion Skills

## Overview

Spawn linked characters that share fate with their main character. Companions use characterId + 10000 and increase team capacity.

## Implementation

When activated, finds a random available tile and places the companion:

```typescript
const companionId = characterId + 10000
grid.setTile(randomTile.hex.getId(), {
  characterId: companionId,
  team,
  state,
})
grid.addCompanionLink(characterId, companionId, team)
```

Key features:

- Removing either unit removes both
- Team-aware tracking via `mainId-team` keys
- Visual differentiation via `companionColorModifier`
- Optional range override via `companionRange`
