/* Every prediction model, and the one both pages use. A model added to the
 * list is checked by the tests every model must pass and can be measured
 * beside the others by the external report generator's studies. */

import { decidedGames } from '../data/games.ts'
import { kindRule, type KindOf } from '../data/kinds.ts'
import type { SlData } from '../data/types.ts'
import { sharedModel } from './shared.ts'
import type { Model, ModelKind } from './types.ts'

export const MODELS: readonly ModelKind[] = [sharedModel]

export const PAGE_MODEL: ModelKind = sharedModel

// A model learned from the file's season, with the kind rule for teams the
// file does not hold as a recorded team.
export interface SlLearned {
  model: Model
  kindOf: KindOf
}

export const learnSeason = (data: SlData, kind: ModelKind = PAGE_MODEL): SlLearned => ({
  model: kind.learn(decidedGames(data)),
  kindOf: kindRule(data.teams),
})
