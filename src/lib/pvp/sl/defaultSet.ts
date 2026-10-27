/* The set the generator gives before a roster is picked. The guide index's
 * card draws it, worked out once per build (scripts/slPreview.ts) so the index
 * loads neither the data file nor the chooser. */

import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrMax,
  type AttrRecord,
} from '@/lib/characters/attributes'
import { loadCharacters } from '@/utils/dataLoader'
import { chooseSlSet } from './chooser'
import { decodeSlData } from './codec'
import { choiceSeason, slTeamData } from './team'
import type { SlChoiceTeam, SlPick } from './types'

// Every hero's levels before a roster is picked: the top ones, where the
// recorded opponents are counted, so the set is the records' own best.
export const TOP_LEVELS: AttrRecord = {
  [ATTR_PARAGON]: attrMax(ATTR_PARAGON),
  [ATTR_REFINEMENT]: attrMax(ATTR_REFINEMENT),
}

export interface SlDefaultSet {
  // The set as one encoded 5v5 team, as Save as team stores it.
  data: string
  teams: (Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> & {
    // Index into the data file's maps.
    map: number
  })[]
}

export async function defaultSlSet(bytes: Uint8Array): Promise<SlDefaultSet | null> {
  const file = await decodeSlData(bytes)
  const picks: SlPick[] = loadCharacters()
    .filter((c) => !c.placeholder)
    .map((c) => ({
      id: c.id,
      faction: c.faction,
      paragon: TOP_LEVELS[ATTR_PARAGON]!,
      refinement: TOP_LEVELS[ATTR_REFINEMENT]!,
    }))
  const set = chooseSlSet(file, picks)
  if (!set) return null
  return {
    data: slTeamData(file, set, picks),
    teams: set.teams.map((t) => ({
      map: choiceSeason(file, t).teams[t.team]!.map,
      core: t.core,
      flex: t.flex,
      pairs: t.pairs,
    })),
  }
}
