import { describe, expect, it } from 'vitest'

import { DEFAULT_MAP_KEY, MAPS } from '@/lib/maps'
import {
  DEFAULT_TEAM_MODE,
  DEFAULT_VARIANT,
  initialMaps,
  isTeamModeKey,
  matchVariant,
  normalizeTeamPayload,
  resolveTeamMode,
  TEAM_MODE_ORDER,
  TEAM_MODES,
  TEAM_VARIANTS,
  variantMaps,
  variantsForMode,
  type TeamVariantChoice,
} from '@/lib/teams/modes'
import { MAX_GRID_COUNT } from '@/stores/grids'
import type { MultiGridState } from '@/utils/gridStateSerializer'

const boards = (count: number): MultiGridState => ({
  boards: Array.from({ length: count }, () => ({ m: 'arena1' })),
})

describe('TEAM_MODES registry', () => {
  it('lists every mode exactly once in TEAM_MODE_ORDER', () => {
    expect([...TEAM_MODE_ORDER].sort()).toEqual(Object.keys(TEAM_MODES).sort())
    expect(new Set(TEAM_MODE_ORDER).size).toBe(TEAM_MODE_ORDER.length)
  })

  it('keeps defaultMaps aligned with boardCount and within the grid cap', () => {
    for (const cfg of Object.values(TEAM_MODES)) {
      expect(cfg.defaultMaps).toHaveLength(cfg.boardCount)
      expect(cfg.boardCount).toBeGreaterThanOrEqual(1)
      expect(cfg.boardCount).toBeLessThanOrEqual(MAX_GRID_COUNT)
    }

    // Wrap layout is defined only for the 5-board shape
    const wrapCounts = Object.values(TEAM_MODES)
      .filter((cfg) => cfg.canWrap)
      .map((cfg) => cfg.boardCount)
    expect(wrapCounts.every((count) => count === 5)).toBe(true)
  })

  it('references only maps that exist', () => {
    for (const cfg of Object.values(TEAM_MODES)) {
      for (const map of cfg.defaultMaps) {
        expect(MAPS[map], `${cfg.key} references unknown map ${map}`).toBeDefined()
      }
    }
  })

  it('orders modes by ascending board count so smallest-fit inference works', () => {
    const counts = TEAM_MODE_ORDER.map((key) => TEAM_MODES[key].boardCount)
    expect([...counts].sort((a, b) => a - b)).toEqual(counts)
  })

  // One slot per count, smallest-fit inference, and the shim's count-based
  // healing all rest on this: a mode IS a board count. An in-game mode on an
  // existing count is a TEAM_VARIANTS row, never a second mode.
  it('keeps board counts unique across modes', () => {
    const counts = Object.values(TEAM_MODES).map((cfg) => cfg.boardCount)
    expect(new Set(counts).size).toBe(counts.length)
  })

  it('points every initialVariant at a variant of that mode', () => {
    for (const cfg of Object.values(TEAM_MODES)) {
      if (cfg.initialVariant === undefined) continue
      expect(TEAM_VARIANTS[cfg.initialVariant].mode).toBe(cfg.key)
    }
  })
})

describe('TEAM_VARIANTS registry', () => {
  it('pins the registered types to their modes', () => {
    expect(Object.keys(TEAM_VARIANTS).sort()).toEqual(['gd', 'sl'])
    expect(TEAM_VARIANTS.sl.mode).toBe('5v5')
    expect(TEAM_VARIANTS.gd.mode).toBe('3v3')
    expect(TEAM_MODES['5v5'].initialVariant).toBe('sl')
    expect(TEAM_MODES['3v3'].initialVariant).toBe('gd')
  })

  it('keeps each list aligned with its mode and made of real maps', () => {
    for (const variant of Object.values(TEAM_VARIANTS)) {
      expect(variant.key).toBe(
        Object.keys(TEAM_VARIANTS).find((k) => TEAM_VARIANTS[k as 'sl'] === variant),
      )
      expect(variant.maps).toHaveLength(TEAM_MODES[variant.mode].boardCount)
      for (const map of variant.maps) {
        expect(MAPS[map], `${variant.key} references unknown map ${map}`).toBeDefined()
      }
    }
  })

  it('never equals its mode default list and stays unique within its mode', () => {
    for (const mode of TEAM_MODE_ORDER) {
      const lists = variantsForMode(mode).map((variant) => variant.maps.join(','))
      expect(lists).not.toContain(TEAM_MODES[mode].defaultMaps.join(','))
      expect(new Set(lists).size).toBe(lists.length)
    }
  })

  it('reserves the "default" choice: no variant key may collide with it', () => {
    expect(Object.keys(TEAM_VARIANTS)).not.toContain(DEFAULT_VARIANT)
  })

  it('round-trips every choice through variantMaps and matchVariant', () => {
    for (const mode of TEAM_MODE_ORDER) {
      const choices: TeamVariantChoice[] = [
        DEFAULT_VARIANT,
        ...variantsForMode(mode).map((variant) => variant.key),
      ]
      for (const choice of choices) {
        expect(matchVariant(mode, variantMaps(mode, choice))).toBe(choice)
      }
    }
  })
})

describe('matchVariant', () => {
  it('matches a list only in board order', () => {
    expect(matchVariant('5v5', TEAM_VARIANTS.sl.maps)).toBe('sl')
    expect(matchVariant('5v5', [...TEAM_VARIANTS.sl.maps].reverse())).toBeNull()
    expect(matchVariant('3v3', TEAM_VARIANTS.gd.maps)).toBe('gd')
  })

  it('lights Default for the neutral list and nothing for custom maps', () => {
    expect(matchVariant('3v3', ['arena1', 'arena1', 'arena1'])).toBe(DEFAULT_VARIANT)
    expect(matchVariant('3v3', ['arena1', 'arena3', 'arena1'])).toBeNull()
    expect(matchVariant('1v1', ['arena2'])).toBeNull()
  })

  it('rejects a list of the wrong length', () => {
    expect(matchVariant('3v3', ['arena1', 'arena1'])).toBeNull()
    expect(matchVariant('1v1', ['arena1', 'arena1'])).toBeNull()
  })

  it('treats a missing key as the default map for that board', () => {
    expect(matchVariant('3v3', [undefined, DEFAULT_MAP_KEY, undefined])).toBe(DEFAULT_VARIANT)
    expect(matchVariant('5v5', [undefined, ...TEAM_VARIANTS.sl.maps.slice(1)])).toBe('sl')
  })
})

describe('initialMaps', () => {
  it('opens 5v5 on Supreme League, 3v3 on Guild Duel, and 1v1 on the default map', () => {
    expect(initialMaps('5v5')).toEqual(TEAM_VARIANTS.sl.maps)
    expect(initialMaps('3v3')).toEqual(TEAM_VARIANTS.gd.maps)
    expect(initialMaps('1v1')).toEqual([DEFAULT_MAP_KEY])
  })
})

describe('isTeamModeKey', () => {
  it('accepts registry keys and rejects everything else, the retired 5v5sl included', () => {
    expect(isTeamModeKey('3v3')).toBe(true)
    expect(isTeamModeKey('5v5')).toBe(true)
    expect(isTeamModeKey('5v5sl')).toBe(false)
    expect(isTeamModeKey('2v2')).toBe(false)
    expect(isTeamModeKey(undefined)).toBe(false)
    expect(isTeamModeKey(3)).toBe(false)
    // Inherited property names are not modes.
    expect(isTeamModeKey('toString')).toBe(false)
    expect(isTeamModeKey('__proto__')).toBe(false)
  })
})

describe('resolveTeamMode', () => {
  it('honors a present mode whose board count matches', () => {
    expect(resolveTeamMode({ ...boards(3), mode: '3v3' })).toBe('3v3')
    expect(resolveTeamMode({ ...boards(5), mode: '5v5' })).toBe('5v5')
    expect(resolveTeamMode({ ...boards(1), mode: '1v1' })).toBe('1v1')
  })

  it('treats a contradictory mode as absent (count wins)', () => {
    expect(resolveTeamMode({ ...boards(2), mode: '5v5' })).toBe('3v3')
    expect(resolveTeamMode({ ...boards(5), mode: '3v3' })).toBe('5v5')
  })

  it('treats an unknown mode as absent, the retired 5v5sl included', () => {
    expect(resolveTeamMode({ ...boards(3), mode: '9v9' })).toBe('3v3')
    expect(resolveTeamMode({ ...boards(5), mode: '5v5sl' })).toBe('5v5')
  })

  it('infers the smallest fitting mode for mode-less payloads', () => {
    expect(resolveTeamMode(boards(1))).toBe('1v1')
    expect(resolveTeamMode(boards(2))).toBe('3v3')
    expect(resolveTeamMode(boards(3))).toBe('3v3')
    expect(resolveTeamMode(boards(4))).toBe('5v5')
    expect(resolveTeamMode(boards(5))).toBe('5v5')
  })

  it('falls back to the default mode when nothing fits (crafted oversize)', () => {
    expect(resolveTeamMode(boards(7))).toBe(DEFAULT_TEAM_MODE)
  })
})

describe('normalizeTeamPayload', () => {
  it('pads short payloads with empty boards on the mode default maps', () => {
    const payload: MultiGridState = { boards: [{ m: 'arena2', c: [[1, 11, 0]] }] }
    const normalized = normalizeTeamPayload(payload, '3v3')
    expect(normalized.boards).toHaveLength(3)
    expect(normalized.boards[0]).toEqual({ m: 'arena2', c: [[1, 11, 0]] })
    expect(normalized.boards[1]).toEqual({ m: 'arena1' })
    expect(normalized.boards[2]).toEqual({ m: 'arena1' })
    expect(normalized.mode).toBe('3v3')
  })

  // Padding is shape repair for a crafted payload, not a fresh slate: the
  // neutral map, never the mode's initial type list.
  it('pads with the default map even where the mode opens on a named type', () => {
    const normalized = normalizeTeamPayload(boards(2), '5v5')
    expect(normalized.boards.map((b) => b.m)).toEqual(Array<string>(5).fill(DEFAULT_MAP_KEY))
  })

  it('truncates oversize payloads', () => {
    const normalized = normalizeTeamPayload(boards(5), '3v3')
    expect(normalized.boards).toHaveLength(3)
  })

  it('does not mutate the input payload', () => {
    const payload = boards(1)
    normalizeTeamPayload(payload, '3v3')
    expect(payload.boards).toHaveLength(1)
  })
})

describe('normalizeTeamPayload synergy strip', () => {
  it('strips synergy units from modes that do not allow them', () => {
    const state = {
      boards: [{ y: [[1, 50, 1]] }, { c: [[2, 7, 1]] }, { y: [[3, 60, 2]] }],
      mode: '3v3',
    }
    const normalized = normalizeTeamPayload(state, '3v3')
    expect(normalized.boards).toHaveLength(3)
    expect(normalized.boards.every((board) => board.y === undefined)).toBe(true)
    expect(normalized.boards[1]!.c).toEqual([[2, 7, 1]])
  })

  it('keeps synergy units on 1v1', () => {
    const normalized = normalizeTeamPayload({ boards: [{ y: [[1, 50, 1]] }] }, '1v1')
    expect(normalized.boards[0]!.y).toEqual([[1, 50, 1]])
  })
})
