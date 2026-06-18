import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { findUnitBehind } from '../utils/targeting'

// Highlights the same-team unit directly behind Thador (his lieutenant): the
// adjacent back tile, lowest hex ID for allies and highest for enemies.
registerSkill(
  createTileHighlightSkill({
    id: 'thador',
    characterId: 84,
    tileColor: '#6d9c86',
    calculateTarget: findUnitBehind,
  }),
)
