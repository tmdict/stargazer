/* The set the generator gives before a roster is picked. The guide index's
 * card draws it, worked out once per build (scripts/packModule.ts) so the index
 * loads neither the data file, the model nor the chooser. */

import { ATTR_PARAGON, ATTR_REFINEMENT, TOP_LEVELS } from '@/lib/characters/attributes'
import { loadCharacters } from '@/lib/dataLoader'
import { artifactSurvives } from '@/lib/seasonal'
import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { decodeSlData } from '../data/codec'
import { readSlFile } from '../model/reader'
import { chooseSlSet } from './chooser'
import { boardDraws, shownFormation } from './formation'
import { slBoards } from './setType'
import { slTeamData } from './team'
import type { SlChoiceTeam, SlPick } from './types'

export interface SlDefaultSet {
  // The set as one encoded 5v5 team.
  data: string
  teams: (Pick<SlChoiceTeam, 'core' | 'flex' | 'pairs'> & {
    // The map's place in the Supreme League list.
    map: number
  })[]
}

export async function defaultSlSet(bytes: Uint8Array<ArrayBuffer>): Promise<SlDefaultSet | null> {
  const file = await decodeSlData(bytes)
  // The top levels, where the recorded opponents are counted, so the set is
  // the records' own best.
  const picks: SlPick[] = loadCharacters()
    .filter((c) => !c.placeholder)
    .map((c) => ({
      id: c.id,
      faction: c.faction,
      paragon: TOP_LEVELS[ATTR_PARAGON]!,
      refinement: TOP_LEVELS[ATTR_REFINEMENT]!,
    }))
  const boards = slBoards(file, TEAM_VARIANTS.sl.maps, 'sl')
  const set = chooseSlSet(
    file,
    readSlFile(file),
    picks,
    (id) => artifactSurvives(file.season, id),
    boards,
  )
  if (!set) return null
  return {
    data: slTeamData(
      file,
      set,
      picks,
      boards,
      boardDraws(file, set, boards).map((draw) => shownFormation(draw)),
    ),
    teams: set.teams.map((t, index) => ({
      map: boards[index]!.map,
      core: t.core,
      flex: t.flex,
      pairs: t.pairs,
    })),
  }
}
