# Vala Skill

Requirements on how to implement Vala's skill.

## Preparation

To prepare, first read the following documents and files to understand current skill system. Vala's skill share many similarities to Silvina's skill.

Documentations:

- `docs/ARCHITECTURE.md`
- `docs/architecture/SKILLS.md`
- `docs/architecture/skills/TARGETING.md`

Grid, Hex and Targeting Arrow implementations:

- `src/lib/grid.ts`
- `src/lib/skill.ts`
- `src/lib/skills/silvina.ts`
- `src/lib/skills/utils/targeting.ts`
- `src/components/SkillTargeting.vue`

Placeholder Vala skill class:

- `src/lib/skills/vala.ts`

## Skill Overview

When placed on a grid, Vala will target the opposing team (enemy or ally) character that's placed on a grid tile furthest from her. To accomplish this, simply retrieve all opposing team grid tiles that has a character placed, and find the one that is furthest away (longest distance) from Vala.

Try to use existing methods where possible, from grid.ts, hex.ts, or `src/lib/skills/utils/targeting.ts`. Goal is to avoid creating many functions that are all similar, if possible.

## Tie Breaking

In case of a tie, if it is Ally Vala targeting Enemy character, target the hex with smaller ID. If it is enemy Vala targeting Ally character, prefer the larger hex ID instead (180 degree rotatio of logic)

## UI and Visual

Utilize existing SkillTargeting Vue component to render a targeting arrow, from Vala to the target unit. Color of the arrow should be the color defined in Vala's targetingColorModifier.

## Other Notes

The implementation of Vala's skill should be very similar to Silvina's, and we should try to re-use existing methods and capabilities where possible (can make existing function more generic if needed). The only difference should be:

- Targeting criteria
- Tie-breaking logic
- UI color
