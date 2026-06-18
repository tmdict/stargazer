import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { findUnitBehind } from '../utils/targeting'

// Highlights the same-team unit directly behind Hugin (the ally his skill
// supports): the adjacent back tile, lowest hex ID for allies and highest for
// enemies.
registerSkill(
  createTileHighlightSkill({
    id: 'hugin',
    characterId: 65,
    tileColor: '#0288d1',
    calculateTarget: findUnitBehind,
  }),
)
