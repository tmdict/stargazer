import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { SKILL_COLORS } from '../utils/colors'
import { findUnitBehind } from '../utils/targeting'

// Highlights the same-team unit directly behind Gunnar (the ally his skill
// shields): the adjacent back tile, lowest hex ID for allies and highest for
// enemies.
registerSkill(
  createTileHighlightSkill({
    id: 'gunnar',
    characterId: 106,
    tileColor: SKILL_COLORS.purple,
    fill: true,
    calculateTarget: findUnitBehind,
  }),
)
