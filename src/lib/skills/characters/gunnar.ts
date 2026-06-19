import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { findUnitBehind } from '../utils/targeting'

// Highlights the same-team unit directly behind Gunnar (the ally his skill
// shields): the adjacent back tile, lowest hex ID for allies and highest for
// enemies.
registerSkill(
  createTileHighlightSkill({
    id: 'gunnar',
    characterId: 106,
    tileColor: '#9661f1',
    fill: true,
    calculateTarget: findUnitBehind,
  }),
)
