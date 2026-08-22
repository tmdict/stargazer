# Companion Skills

## Overview

Spawn linked characters that share fate with their main character. Companions use offset IDs (10000+, 20000+, etc.) and increase team capacity.

- Removing one unit removes all from the map
- Team-aware tracking via `mainId-team` keys
- Visual differentiation via `companionColorModifier` and `companionImageModifier`
- Optional range override via `companionRange`

## The Factory

All companion skills (Phraesto, Elijah & Lailah, Zanie) are registrations of `createCompanionSkill` from `/src/lib/skills/utils/builders.ts`:

```typescript
registerSkill(
  createCompanionSkill({
    id: 'zanie',
    characterId: 89,
    name: 'Turret',
    description: '…',
    count: 2, // companions to spawn (default 1)
    companionImageModifier: 'zanie-turret',
    companionRange: 3,
  }),
)
```

The factory owns the full lifecycle:

- **Activation**: derives the companion IDs (`N * companionIdOffset + characterId` for N = 1..count), raises team capacity by `count`, places each companion on a random free tile of the team's side, links it to the main character, and applies the configured modifiers
- **Failure**: a placement failure rolls back already-placed companions and the capacity bump, then throws — so the surrounding placement transaction (`executePlaceCharacter`) fails as a whole
- **Deactivation**: removes the companions, their links and modifiers, and restores capacity to `BASE_TEAM_SIZE` semantics (clamped, never below the base)

## Companion ID Ranges

Companions are namespaced as `N * COMPANION_ID_OFFSET + mainCharacterId`
(`COMPANION_ID_OFFSET = 10000`), occupying the band between regular characters and
`PHANTIMAL_ID_OFFSET` (100000):

- **10000-19999**: First companion (N=1)
- **20000-29999**: Second companion (N=2)
- **…up to 99999**: Further companions, before the phantimal range (100000-199999)

The same layout repeats inside the synergy band (`SYNERGY_ID_OFFSET = 200000`):
a synergy hero's companions land at `200000 + N * 10000 + baseId`. The factory
derives companion IDs from the placed id (`ctx.characterId`), so a hero and its
friend-assist copy field companions side by side without colliding.

`getMainCharacterId` recovers the main character ID from any companion ID by
subtracting the companion index within its band (via `decomposeUnitId`), so a
synergy companion cascades to the synergy main, never the base hero.
