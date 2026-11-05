/* The heroes a set is chosen from: each hero the levels hold, at those levels,
 * but those the data file cannot rate yet (unratedHeroes), so the generator
 * page and Generate on the Arena and Teams choose from the same heroes. */

import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import type { SlPick } from './types'

export const slPicks = (
  levels: Readonly<Record<string, AttrRecord>>,
  factionOf: (id: number) => string | undefined,
  locked: ReadonlySet<number>,
): SlPick[] =>
  Object.entries(levels).flatMap(([key, record]) => {
    const id = Number(key)
    const faction = factionOf(id)
    return faction === undefined || locked.has(id)
      ? []
      : [
          {
            id,
            faction,
            paragon: record[ATTR_PARAGON] ?? 0,
            refinement: record[ATTR_REFINEMENT] ?? 0,
          },
        ]
  })
