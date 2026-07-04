import { describe, expect, it } from 'vitest'

import { MAPS } from '@/lib/maps'
import {
  DEFAULT_TEAM_MODE,
  isTeamModeKey,
  normalizeTeamPayload,
  resolveTeamMode,
  TEAM_MODE_ORDER,
  TEAM_MODES,
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
      expect(cfg.key in TEAM_MODES).toBe(true)
    }
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

  it('default mode is valid and wrap is 5-board-only', () => {
    expect(isTeamModeKey(DEFAULT_TEAM_MODE)).toBe(true)
    const wrapCounts = Object.values(TEAM_MODES)
      .filter((cfg) => cfg.canWrap)
      .map((cfg) => cfg.boardCount)
    expect(wrapCounts.every((count) => count === 5)).toBe(true)
  })
})

describe('isTeamModeKey', () => {
  it('accepts registry keys and rejects everything else', () => {
    expect(isTeamModeKey('3v3')).toBe(true)
    expect(isTeamModeKey('5v5sl')).toBe(true)
    expect(isTeamModeKey('2v2')).toBe(false)
    expect(isTeamModeKey(undefined)).toBe(false)
    expect(isTeamModeKey(3)).toBe(false)
  })
})

describe('resolveTeamMode', () => {
  it('honors a present mode whose board count matches', () => {
    expect(resolveTeamMode({ ...boards(3), mode: '3v3' })).toBe('3v3')
    expect(resolveTeamMode({ ...boards(5), mode: '5v5' })).toBe('5v5')
    expect(resolveTeamMode({ ...boards(1), mode: '1v1' })).toBe('1v1')
  })

  it('treats a contradictory mode as absent (count wins)', () => {
    expect(resolveTeamMode({ ...boards(2), mode: '5v5sl' })).toBe('3v3')
    expect(resolveTeamMode({ ...boards(5), mode: '3v3' })).toBe('5v5sl')
  })

  it('treats an unknown mode as absent', () => {
    expect(resolveTeamMode({ ...boards(3), mode: '9v9' })).toBe('3v3')
  })

  it('infers mode-less payloads: 5 boards are Supreme League (legacy links)', () => {
    expect(resolveTeamMode(boards(5))).toBe('5v5sl')
  })

  it('infers the smallest fitting mode for other counts', () => {
    expect(resolveTeamMode(boards(1))).toBe('1v1')
    expect(resolveTeamMode(boards(2))).toBe('3v3')
    expect(resolveTeamMode(boards(3))).toBe('3v3')
    expect(resolveTeamMode(boards(4))).toBe('5v5')
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

  it('pads with the per-index default map (Supreme League keeps its list)', () => {
    const normalized = normalizeTeamPayload(boards(2), '5v5sl')
    expect(normalized.boards.map((b) => b.m)).toEqual([
      'arena1',
      'arena1',
      'arena3',
      'preset-sr11',
      'preset-sr1',
    ])
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
