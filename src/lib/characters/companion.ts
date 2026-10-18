import { COMPANION_ID_OFFSET, type Grid } from '../grid'
import { getRegisteredSkills } from '../skills/registry'
import { getCharacterSkill, SkillManager } from '../skills/skill'
import { Team } from '../types/team'
import { findCharacterHex } from './character'
import { companionLocalId } from './phantimal'
import { performPlace } from './place'
import { performRemove } from './remove'

export interface CompanionPosition {
  companionId: number
  hexId: number
  team: Team
  mainCharId: number
}

// Companion system helpers

// The companions a unit's skill spawns, in spawn order. The arithmetic holds in
// every band, so a phantimal's companions come out in the phantimal band.
export function companionIdsOf(ownerId: number): number[] {
  const count = getCharacterSkill(ownerId)?.companionCount ?? 0
  return Array.from({ length: count }, (_, i) => (i + 1) * COMPANION_ID_OFFSET + ownerId)
}

// Companions drawn with an image of their own (Zanie's turrets, Wedge of Power)
// rather than their owner's portrait: the image's name, under the id of the
// first companion, since a skill's companions all share it.
export function companionImages(): { unitId: number; image: string }[] {
  return getRegisteredSkills().flatMap((skill) => {
    const [first] = companionIdsOf(skill.characterId)
    return skill.companionImageModifier && first !== undefined
      ? [{ unitId: first, image: skill.companionImageModifier }]
      : []
  })
}

export function isCompanionId(grid: Grid, characterId: number): boolean {
  // Classified on the band-local id, so companions of synergy heroes and
  // phantimals (offset + N * 10000 + owner) count too. The upper bound keeps a
  // raw phantimal-band value from reading as a base-band companion.
  const localId = companionLocalId(characterId)
  return localId >= grid.companionIdOffset && localId < grid.phantimalIdOffset
}

export function getMainCharacterId(grid: Grid, companionId: number): number {
  if (!isCompanionId(grid, companionId)) {
    return companionId
  }
  // Subtraction rather than modulo keeps the main in the companion's own band:
  // a synergy companion cascades to the synergy main, never the base hero.
  const localId = companionLocalId(companionId)
  return companionId - Math.floor(localId / grid.companionIdOffset) * grid.companionIdOffset
}

export function getCompanions(grid: Grid, mainCharacterId: number, team: Team): Set<number> {
  const key = `${mainCharacterId}-${team}`
  return grid.companionLinks.get(key) || new Set()
}

export function addCompanionLink(
  grid: Grid,
  mainId: number,
  companionId: number,
  team: Team,
): void {
  const key = `${mainId}-${team}`
  if (!grid.companionLinks.has(key)) {
    grid.companionLinks.set(key, new Set())
  }
  grid.companionLinks.get(key)!.add(companionId)
}

export function clearCompanionLinks(grid: Grid, mainCharacterId: number, team: Team): void {
  const key = `${mainCharacterId}-${team}`
  grid.companionLinks.delete(key)
}

export function storeCompanionPositions(
  grid: Grid,
  characterId: number,
  team: Team,
): CompanionPosition[] {
  const positions: CompanionPosition[] = []
  const companions = getCompanions(grid, characterId, team)

  companions.forEach((companionId) => {
    const hexId = findCharacterHex(grid, companionId, team)
    if (hexId !== null) {
      positions.push({
        companionId,
        hexId,
        team,
        mainCharId: characterId,
      })
    }
  })

  return positions
}

// Move companions onto target hexes. Lifts them all off first, then places
// them, so two companions can trade hexes (Zanie) without the first place
// failing on the second's tile. Raw ops sidestep the owner-removal cascade in
// executeRemoveCharacter; color and image modifiers key off id + team and so
// survive the move.
export function repositionCompanions(
  grid: Grid,
  team: Team,
  targets: { companionId: number; hexId: number }[],
): void {
  const lifts = targets.map((t) => ({
    ...t,
    from: findCharacterHex(grid, t.companionId, team),
  }))
  lifts.forEach((l) => {
    if (l.from !== null) performRemove(grid, l.from)
  })
  lifts.forEach((l) => {
    if (!performPlace(grid, l.hexId, l.companionId, team)) {
      console.warn(`Failed to reposition companion ${l.companionId} to hex ${l.hexId}`)
    }
  })
}

export function restoreCompanions(
  grid: Grid,
  skillManager: SkillManager,
  mainCharId: number,
  companionPositions: CompanionPosition[],
): void {
  companionPositions
    .filter((pos) => pos.mainCharId === mainCharId)
    .forEach(({ companionId, hexId: originalHexId, team }) => {
      const currentHexId = findCharacterHex(grid, companionId, team)
      if (currentHexId !== null && currentHexId !== originalHexId) {
        if (!performRemove(grid, currentHexId)) {
          console.warn(
            `Failed to remove companion ${companionId} from hex ${currentHexId} during restoration`,
          )
        }
        performPlace(grid, originalHexId, companionId, team)
        const skill = getCharacterSkill(mainCharId)
        if (skill?.companionColorModifier) {
          skillManager.addCharacterColorModifier(companionId, team, skill.companionColorModifier)
        }
        if (skill?.companionImageModifier) {
          skillManager.addCharacterImageModifier(companionId, team, skill.companionImageModifier)
        }
      }
    })
}
