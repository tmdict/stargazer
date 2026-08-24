import { describe, expect, it } from 'vitest'

import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

describe('getTeamFromTileState', () => {
  it('maps tile states to their team, null for neutral states', () => {
    expect(getTeamFromTileState(State.AVAILABLE_ALLY)).toBe(Team.ALLY)
    expect(getTeamFromTileState(State.OCCUPIED_ALLY)).toBe(Team.ALLY)
    expect(getTeamFromTileState(State.AVAILABLE_ENEMY)).toBe(Team.ENEMY)
    expect(getTeamFromTileState(State.OCCUPIED_ENEMY)).toBe(Team.ENEMY)
    expect(getTeamFromTileState(State.BLOCKED)).toBeNull()
    expect(getTeamFromTileState(State.DEFAULT)).toBeNull()
  })
})
