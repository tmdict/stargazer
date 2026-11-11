import { describe, expect, it } from 'vitest'

import { permanentArtifact } from '@/lib/pvp/generator/artifacts'

// Artifacts 2, 3 and 5 are permanent; 7 and up are the season's.
describe('permanentArtifact', () => {
  it('takes the permanent artifact the team was recorded with most', () => {
    const own = [
      { id: 8, games: 40 },
      { id: 5, games: 6 },
      { id: 3, games: 2 },
    ]
    expect(permanentArtifact({ own, fallback: [2, 9] })).toBe(5)
  })

  it('falls back to the first permanent artifact of the list', () => {
    expect(permanentArtifact({ own: [{ id: 8, games: 40 }], fallback: [9, 14, 3, 2] })).toBe(3)
  })

  it('is null when the team can reach no permanent artifact', () => {
    expect(permanentArtifact({ own: [{ id: 8, games: 40 }], fallback: [9, 14] })).toBeNull()
  })
})
