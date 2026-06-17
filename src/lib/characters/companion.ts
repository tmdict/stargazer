import type { Grid } from '../grid'
import { getCharacterSkill, SkillManager } from '../skills/skill'
import { Team } from '../types/team'
import { findCharacterHex } from './character'
import { performPlace } from './place'
import { performRemove } from './remove'

export interface CompanionPosition {
  companionId: number
  hexId: number
  team: Team
  mainCharId: number
}

// Companion system helpers

export function isCompanionId(grid: Grid, characterId: number): boolean {
  // Phantimals live above the companion range, so bound the upper end to keep
  // them from being treated as companions.
  return characterId >= grid.companionIdOffset && characterId < grid.phantimalIdOffset
}

export function getMainCharacterId(grid: Grid, companionId: number): number {
  if (!isCompanionId(grid, companionId)) {
    return companionId // Already a main character
  }
  return companionId % grid.companionIdOffset
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

export function removeCompanionLink(
  grid: Grid,
  mainId: number,
  companionId: number,
  team: Team,
): void {
  const key = `${mainId}-${team}`
  const companions = grid.companionLinks.get(key)
  if (companions) {
    companions.delete(companionId)
    if (companions.size === 0) {
      grid.companionLinks.delete(key)
    }
  }
}

export function clearCompanionLinks(grid: Grid, mainCharacterId: number, team: Team): void {
  const key = `${mainCharacterId}-${team}`
  grid.companionLinks.delete(key)
}

// Stores companion positions before skill deactivation
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

// Restores companions to original positions
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
        // Remove from current position
        if (!performRemove(grid, currentHexId)) {
          console.warn(
            `Failed to remove companion ${companionId} from hex ${currentHexId} during restoration`,
          )
        }
        // Place at original position
        performPlace(grid, originalHexId, companionId, team)
        // Re-add color modifier (use companion color for companions)
        const skill = getCharacterSkill(mainCharId)
        if (skill?.companionColorModifier) {
          skillManager.addCharacterColorModifier(companionId, team, skill.companionColorModifier)
        }
        // Re-add image modifier if skill has one
        if (skill?.companionImageModifier) {
          skillManager.addCharacterImageModifier(companionId, team, skill.companionImageModifier)
        }
      }
    })
}
