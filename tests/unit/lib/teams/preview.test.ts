import { describe, expect, it } from 'vitest'

import { teamHasSynergy } from '@/lib/teams/preview'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const encode = (state: MultiGridState): string => encodeMultiGridStateToUrl(state)

describe('teamHasSynergy', () => {
  it('is true when any board fields a synergy hero', () => {
    const record: MultiGridState = {
      boards: [
        { m: 'arena1', c: [[1, 11, Team.ALLY]] },
        { m: 'arena1', y: [[6, 16, Team.ALLY]] },
        { m: 'arena1' },
      ],
      mode: '3v3',
    }
    expect(teamHasSynergy(encode(record))).toBe(true)
  })

  it('ignores records without y and y sections holding only companion locals', () => {
    expect(
      teamHasSynergy(encode({ boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }], mode: '1v1' })),
    ).toBe(false)
    expect(
      teamHasSynergy(
        encode({ boards: [{ m: 'arena1', y: [[6, 10016, Team.ALLY]] }], mode: '1v1' }),
      ),
    ).toBe(false)
  })

  it('is false for undecodable data', () => {
    expect(teamHasSynergy('not-a-record')).toBe(false)
  })
})
