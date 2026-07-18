import { registerSkill } from '../registry'
import { createTileHighlightSkill } from '../utils/builders'
import { findAdjacentPriorityTarget } from '../utils/targeting'

// Targets an ally on adjacent tiles behind him (lower hex ID for ally, higher for
// enemy). Prioritizes the tile directly behind, then the higher/lower of the two
// remaining tiles in the row behind.
registerSkill(
  createTileHighlightSkill({
    id: 'daimon',
    characterId: 81,
    tileColor: '#98be5d',
    calculateTarget: findAdjacentPriorityTarget,
  }),
)
