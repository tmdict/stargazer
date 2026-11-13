import { describe, expect, it } from 'vitest'

import { decodeTeamData, encodeTeamData } from '@/lib/teams/codec'
import type { MultiGridState } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'

describe('stored-data codec', () => {
  describe('encodeTeamData and decodeTeamData', () => {
    const encodeRaw = (value: unknown): string => encodeTeamData(value as MultiGridState)

    it('round-trips a multi-board state, preserving its season stamp', () => {
      const state: MultiGridState = {
        boards: [{ m: 'arena1', c: [[1, 11, Team.ALLY]] }, { m: 'arena2' }],
        active: 1,
        d: 3,
        mode: '3v3',
        season: 9,
      }
      expect(decodeTeamData(encodeTeamData(state))).toEqual(state)
    })

    it('sanitizes a crafted invalid season instead of letting it flow', () => {
      const boards = [{ m: 'arena1' }]
      // 1e300 passes Number.isInteger; the upper bound catches it.
      for (const junk of ['banana', -3, 2.5, 1e300]) {
        const decoded = decodeTeamData(encodeRaw({ boards, season: junk }))!
        expect(decoded.season).toBeUndefined()
      }
    })

    it('rejects undecodable input and payloads whose boards are not an array', () => {
      expect(decodeTeamData('!!!invalid!!!')).toBeNull()
      expect(decodeTeamData(encodeRaw({}))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: 'x' }))).toBeNull()
      expect(decodeTeamData(encodeRaw(null))).toBeNull()
    })

    it('rejects crafted payloads with non-object board entries', () => {
      // Consumers past this boundary (canonicalization, validation, restore)
      // read board keys directly, so these must never decode.
      expect(decodeTeamData(encodeRaw({ boards: [null] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [[1, 2]] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{}, 'x'] }))).toBeNull()
    })

    it('rejects crafted payloads whose sections are not the serializer shapes', () => {
      // Section rows are destructured directly by preview, canonicalization
      // and restore, so anything but numeric rows (ids/nulls for `a`, a string
      // for `m`) must never decode; keys outside the contract are ignored.
      expect(decodeTeamData(encodeRaw({ boards: [{ c: {} }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ a: {} }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ t: [5] }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ t: [null] }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ u: [[1, 'x', 1, 1]] }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ a: ['x', null] }] }))).toBeNull()
      expect(decodeTeamData(encodeRaw({ boards: [{ m: 3 }] }))).toBeNull()
      expect(
        decodeTeamData(
          encodeRaw({ boards: [{ m: 'arena1', a: [null, 4], c: [[1, 11, 1]], zz: {} }] }),
        ),
      ).toMatchObject({ boards: [{ m: 'arena1', a: [null, 4], c: [[1, 11, 1]] }] })
    })
  })
})
