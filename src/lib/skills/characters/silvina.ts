import { getOpposingTeam } from '../../characters/character'
import { registerSkill } from '../registry'
import type { SkillContext, SkillTargetInfo } from '../skill'
import { createTargetingSkill } from '../utils/builders'
import { spiralSearchFromTile } from '../utils/ring'
import { getSymmetricalHexId } from '../utils/symmetry'

// Targeting priority:
//   1. Enemy on the symmetrical tile
//   2. Nearest enemy to the symmetrical tile via spiral search
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context
  const opposingTeam = getOpposingTeam(team)

  const symmetricalHexId = getSymmetricalHexId(grid, hexId)
  if (!symmetricalHexId) return null

  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (symmetricalTile?.characterId && symmetricalTile.team === opposingTeam) {
    return {
      targetHexId: symmetricalHexId,
      targetCharacterId: symmetricalTile.characterId,
      metadata: {
        symmetricalHexId,
        isSymmetricalTarget: true,
        examinedTiles: [symmetricalHexId],
      },
    }
  }

  return spiralSearchFromTile(grid, symmetricalHexId, opposingTeam, team)
}

// Targets the enemy on the tile symmetrical to Silvina, falling back to the
// closest enemy to that symmetrical tile.
registerSkill(
  createTargetingSkill({
    id: 'silvina',
    characterId: 39,
    color: '#98be5d',
    arrowType: 'enemy',
    calculateTarget,
  }),
)
