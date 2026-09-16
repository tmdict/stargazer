import { describe, expect, it, vi } from 'vitest'

import { TEAM_VARIANTS } from '@/lib/teams/modes'
import { teamHasSynergy, teamTypeLabelKey, teamVariant } from '@/lib/teams/preview'
import { Team } from '@/lib/types/team'
import type { MultiGridState } from '@/utils/gridStateSerializer'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'

const encode = (state: MultiGridState): string => encodeMultiGridStateToUrl(state)

describe('teamVariant and teamTypeLabelKey', () => {
  it('derives the type from the boards maps against the registry', () => {
    const sl = encode({ boards: TEAM_VARIANTS.sl.maps.map((m) => ({ m })), mode: '5v5' })
    expect(teamVariant(sl)).toBe('sl')
    expect(teamTypeLabelKey(sl)).toBe('app.mode-sl')

    const gd = encode({ boards: TEAM_VARIANTS.gd.maps.map((m) => ({ m })), mode: '3v3' })
    expect(teamVariant(gd)).toBe('gd')
    expect(teamTypeLabelKey(gd)).toBe('app.mode-gd')
  })

  it('reports Default for the neutral list and no chip for default or custom maps', () => {
    const neutral = encode({
      boards: [{ m: 'arena1' }, { m: 'arena1' }, { m: 'arena1' }],
      mode: '3v3',
    })
    expect(teamVariant(neutral)).toBe('default')
    expect(teamTypeLabelKey(neutral)).toBeNull()

    const custom = encode({
      boards: [{ m: 'arena1' }, { m: 'arena3' }, { m: 'arena1' }],
      mode: '3v3',
    })
    expect(teamVariant(custom)).toBeNull()
    expect(teamTypeLabelKey(custom)).toBeNull()
  })

  it('is null for undecodable data', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(teamVariant('not-a-record')).toBeNull()
    warn.mockRestore()
  })
})

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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(teamHasSynergy('not-a-record')).toBe(false)
    warn.mockRestore()
  })
})
