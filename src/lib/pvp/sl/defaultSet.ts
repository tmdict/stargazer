/* The set the generator gives before a roster is picked: every hero at the top
 * levels, where the recorded opponents are counted, so the set is the records'
 * own best. The guide index's card draws it, worked out once per build
 * (scripts/slPreview.ts) so the index loads neither the data file nor the
 * chooser. */

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { loadCharacters } from '@/utils/dataLoader'
import { chooseSlSet } from './chooser'
import { decodeSlData } from './codec'
import { slTeamData } from './team'
import type { SlChoiceTeam, SlPick } from './types'

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
      paragon: attrMax(ATTR_PARAGON),
      refinement: attrMax(ATTR_REFINEMENT),
    }))
  const set = chooseSlSet(file, picks)
  if (!set) return null
  return {
    data: slTeamData(file, set, picks),
    teams: set.teams.map((t) => ({
      map: (t.source === 0 ? file : file.before!).teams[t.team]!.map,
      core: t.core,
      flex: t.flex,
      pairs: t.pairs,
    })),
  }
}
