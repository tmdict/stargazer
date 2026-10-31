import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findUnitInFront } from '../utils/targeting'

// Highlights the same-team unit directly in front of Shadewing (the ally the
// awakening drains when a battle starts): the adjacent front tile, the mirror
// of the tile Gunnar and Thador look behind them.
registerSkill(
  createTileHighlightSkill({
    id: 'shadewing',
    characterId: 96,
    tileColor: SKILL_COLORS.crimson,
    calculateTarget: findUnitInFront,
  }),
)
