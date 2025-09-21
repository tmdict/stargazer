# Companion Skills

## Overview

Spawn linked characters that share fate with their main character. Companions use offset IDs (10000+, 20000+, etc.) and increase team capacity.

- Removing one unit removes all from the map
- Team-aware tracking via `mainId-team` keys
- Visual differentiation via `companionColorModifier` and `companionImageModifier`
- Optional range override via `companionRange`

## Single Companion

When activated, finds a random available tile and places the companion:

```typescript
const companionId = characterId + 10000
grid.setTile(randomTile.hex.getId(), {
  characterId: companionId,
  team,
  state,
})
grid.addCompanionLink(characterId, companionId, team)

// Visual modifiers
if (skill.companionColorModifier) {
  skillManager.addCharacterColorModifier(companionId, team, skill.companionColorModifier)
}
if (skill.companionImageModifier) {
  skillManager.addCharacterImageModifier(companionId, team, skill.companionImageModifier)
}
```

## Multiple Companions

For skills that spawn multiple companions (e.g., Zanie's turrets):

```typescript
const companionIds = [10000 + characterId, 20000 + characterId]

for (const companionId of companionIds) {
  // Place each companion
  performPlace(grid, hexId, companionId, team, true)

  // Link to main character
  addCompanionLink(grid, characterId, companionId, team)

  // Apply visual modifiers
  if (skill.companionImageModifier) {
    skillManager.addCharacterImageModifier(companionId, team, skill.companionImageModifier)
  }
}

// Increase team size by number of companions
setMaxTeamSize(grid, team, currentSize + companionIds.length)
```

## Companion ID Ranges

- **10000-19999**: First companion
- **20000-29999**: Second companion
- **30000+**: Additional companions as needed

The system uses modulo 10000 to get the main character ID from any companion ID.
