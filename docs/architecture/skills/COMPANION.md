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
const companionId = grid.companionIdOffset + characterId
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
const companionIds = [1, 2].map((n) => n * grid.companionIdOffset + characterId)

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

Companions are namespaced as `N * COMPANION_ID_OFFSET + mainCharacterId`
(`COMPANION_ID_OFFSET = 10000`), occupying the band between regular characters and
`PHANTIMAL_ID_OFFSET` (100000):

- **10000-19999**: First companion (N=1)
- **20000-29999**: Second companion (N=2)
- **…up to 99999**: Further companions, before the phantimal range (100000+)

The system uses modulo `COMPANION_ID_OFFSET` to recover the main character ID from
any companion ID (`getMainCharacterId`).
