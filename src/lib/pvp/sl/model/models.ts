/* Every prediction model, and the one both pages use. A model added to the
 * list is checked by the tests every model must pass and can be measured
 * beside the others by the external report generator's studies. */

import { decidedGames } from '../data/games'
import { kindRule, type KindOf } from '../data/kinds'
import type { SlData } from '../data/types'
import { sharedModel } from './shared'
import type { Model, ModelKind } from './types'

export const MODELS: readonly ModelKind[] = [sharedModel]

const PAGE_MODEL: ModelKind = sharedModel

// A model learned from the file's season, with the kind rule for teams the
// file does not hold as a recorded team.
export interface SlLearned {
  model: Model
  kindOf: KindOf
}

export const learnSeason = (data: SlData): SlLearned => ({
  model: PAGE_MODEL.learn(decidedGames(data)),
  kindOf: kindRule(data.teams),
})
