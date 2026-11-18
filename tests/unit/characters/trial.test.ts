import { describe, expect, it } from 'vitest'

import {
  getAllAvailableTilesForTeam,
  getAvailableTeamSize,
  getMaxTeamSize,
  getTilesWithCharacters,
  isCompanionId,
  isHeroUnit,
  toBaseHeroId,
} from '@/lib/characters/character'
import { getMainCharacterId } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import { inPhantimalBand } from '@/lib/characters/phantimal'
import { executePlaceCharacter } from '@/lib/characters/place'
import { executeRemoveCharacter } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { inSynergyBand } from '@/lib/characters/synergy'
import {
  inTrialBand,
  isTrialHeroId,
  toTrialId,
  toTrialPick,
  TRIAL_COPIES,
  trialPickOf,
} from '@/lib/characters/trial'
import { decomposeUnitId } from '@/lib/characters/unitBand'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { getRegisteredSkills, hasCompanionSkill } from '@/lib/skills/registry'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { ID_LOOKUPS, skillSnapshot } from '../fixtures/skills'

const ENEMY_SEEDS = [9001, 9002, 9004]
const COPIES = [1, 2, 3, 4, 5]

const sorted = <T>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1))

const makeBoard = () => {
  const grid = new Grid()
  const sm = new SkillManager(ID_LOOKUPS)
  const enemyTiles = getAllAvailableTilesForTeam(grid, Team.ENEMY)
  ENEMY_SEEDS.forEach((id, i) => {
    const tile = enemyTiles[Math.floor((i * (enemyTiles.length - 1)) / (ENEMY_SEEDS.length - 1))]!
    executePlaceCharacter(grid, sm, tile.hex.getId(), id, Team.ENEMY)
  })
  const freeTile = (team: Team) => getAllAvailableTilesForTeam(grid, team)[0]!.hex.getId()
  return { grid, sm, freeTile }
}

const heroSkills = getRegisteredSkills().filter((skill) => skill.characterId < 10000)
const soloSkills = heroSkills.filter((skill) => !hasCompanionSkill(skill.characterId))
const companionSkills = heroSkills.filter((skill) => hasCompanionSkill(skill.characterId))

describe('Trial id band', () => {
  it('gives each copy a band of its own, laid out like the base ids', () => {
    expect(toTrialId(39, 1)).toBe(300039)
    expect(toTrialId(39, 3)).toBe(500039)
    expect(decomposeUnitId(500039)).toEqual({ synergy: false, localId: 39 })
    expect(decomposeUnitId(510039)).toEqual({ synergy: false, localId: 10039 })
    expect(toBaseHeroId(520039)).toBe(39)
    expect(isTrialHeroId(500039)).toBe(true)
    expect(isTrialHeroId(510039)).toBe(false)
    expect(isCompanionId(510039)).toBe(true)
    expect(getMainCharacterId(520039)).toBe(500039)
    expect(isHeroUnit(500039)).toBe(true)
    expect(isHeroUnit(510039)).toBe(false)
  })

  it('is bounded on both sides', () => {
    const first = toTrialId(1, 1)
    const last = toTrialId(99999, TRIAL_COPIES)
    expect(inTrialBand(first - 2)).toBe(false)
    expect(inSynergyBand(first - 2)).toBe(true)
    expect(inSynergyBand(first)).toBe(false)
    expect(inPhantimalBand(first)).toBe(false)
    expect(inTrialBand(last)).toBe(true)
    expect(inTrialBand(last + 1)).toBe(false)
    expect(decomposeUnitId(last + 40)).toEqual({ synergy: false, localId: last + 40 })
    expect(isCompanionId(last + 10040)).toBe(false)
  })
})

describe('Trial picks', () => {
  it('sit above every copy and read back their unit and tier', () => {
    expect(trialPickOf(toTrialPick(7001, 3))).toEqual({ baseId: 7001, tier: 3 })
    expect(trialPickOf(toTrialPick(1, 0))).toEqual({ baseId: 1, tier: 0 })
    expect(inTrialBand(toTrialPick(1, 0))).toBe(false)
    // The highest id of the last copy's band.
    expect(trialPickOf(toTrialId(99999, TRIAL_COPIES))).toBeNull()
    // A companion's number names no pick, and the band ends after its tiers.
    expect(trialPickOf(toTrialPick(10001, 0))).toBeNull()
    expect(trialPickOf(toTrialPick(1, 10))).toBeNull()
  })
})

describe('Trial copies of one hero on a board', () => {
  it.each(soloSkills.map((skill) => [skill.id, skill.characterId] as const))(
    '%s: five copies fill a team, each with a skill of its own, and clean up',
    (_, hero) => {
      const { grid, sm, freeTile } = makeBoard()
      const ids = COPIES.map((copy) => toTrialId(hero, copy))
      const hexes = ids.map((id) => {
        const hex = freeTile(Team.ALLY)
        expect(executePlaceCharacter(grid, sm, hex, id, Team.ALLY)).toBe(true)
        expect(sm.hasActiveSkill(id, Team.ALLY)).toBe(true)
        return hex
      })
      expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(0)
      expect(
        executePlaceCharacter(grid, sm, freeTile(Team.ALLY), toTrialId(hero, 6), Team.ALLY),
      ).toBe(false)

      const during = skillSnapshot(sm)
      for (const [key] of [...during.targets, ...during.images]) {
        expect(ids).toContain(parseInt(key, 10))
      }

      const enemyHex = freeTile(Team.ENEMY)
      expect(executeMoveCharacter(grid, sm, hexes[2]!, enemyHex, ids[2]!)).toBe(true)
      expect(sm.hasActiveSkill(ids[2]!, Team.ENEMY)).toBe(true)
      expect(sm.hasActiveSkill(ids[2]!, Team.ALLY)).toBe(false)
      expect(executeSwapCharacters(grid, sm, hexes[0]!, enemyHex)).toBe(true)
      expect(sm.hasActiveSkill(ids[0]!, Team.ENEMY)).toBe(true)
      expect(sm.hasActiveSkill(ids[2]!, Team.ALLY)).toBe(true)

      for (const tile of getTilesWithCharacters(grid)) {
        if (inTrialBand(tile.characterId!)) executeRemoveCharacter(grid, sm, tile.hex.getId())
      }
      expect(skillSnapshot(sm)).toEqual({
        targets: [],
        images: [],
        tileColors: [],
        tileFills: [],
        lineCount: 0,
        badges: [],
      })
      expect(
        getTilesWithCharacters(grid)
          .map((tile) => tile.characterId)
          .sort(),
      ).toEqual([...ENEMY_SEEDS].sort())
    },
  )

  it.each(soloSkills.map((skill) => [skill.id, skill.characterId] as const))(
    '%s: removing the middle copy leaves what a board without it draws',
    (_, hero) => {
      const left = makeBoard()
      const fresh = makeBoard()
      const ids = COPIES.map((copy) => toTrialId(hero, copy))
      const hexes = ids.map((id) => {
        const hex = left.freeTile(Team.ALLY)
        executePlaceCharacter(left.grid, left.sm, hex, id, Team.ALLY)
        return hex
      })
      executeRemoveCharacter(left.grid, left.sm, hexes[2]!)
      ids.forEach((id, i) => {
        if (i !== 2) executePlaceCharacter(fresh.grid, fresh.sm, hexes[i]!, id, Team.ALLY)
      })
      const a = skillSnapshot(left.sm)
      const b = skillSnapshot(fresh.sm)
      expect(sorted(a.targets)).toEqual(sorted(b.targets))
      expect(sorted(a.tileColors)).toEqual(sorted(b.tileColors))
      expect(sorted(a.tileFills)).toEqual(sorted(b.tileFills))
      expect(a.lineCount).toBe(b.lineCount)
      expect(sorted(a.badges)).toEqual(sorted(b.badges))
    },
  )

  it.each(companionSkills.map((skill) => [skill.id, skill.characterId] as const))(
    '%s: two copies each keep companions of their own',
    (_, hero) => {
      const { grid, sm, freeTile } = makeBoard()
      const [first, second] = [toTrialId(hero, 1), toTrialId(hero, 2)]
      const firstHex = freeTile(Team.ALLY)
      expect(executePlaceCharacter(grid, sm, firstHex, first, Team.ALLY)).toBe(true)
      expect(executePlaceCharacter(grid, sm, freeTile(Team.ALLY), second, Team.ALLY)).toBe(true)

      const owners = getTilesWithCharacters(grid)
        .map((tile) => tile.characterId!)
        .filter((id) => inTrialBand(id) && isCompanionId(id))
        .map(getMainCharacterId)
      expect(owners).toContain(first)
      expect(owners).toContain(second)

      expect(executeRemoveCharacter(grid, sm, firstHex)).toBe(true)
      const left = getTilesWithCharacters(grid)
        .map((tile) => tile.characterId!)
        .filter(inTrialBand)
      expect(left.length).toBeGreaterThan(1)
      for (const id of left) expect(getMainCharacterId(id)).toBe(second)

      for (const tile of getTilesWithCharacters(grid)) {
        if (tile.characterId === second) executeRemoveCharacter(grid, sm, tile.hex.getId())
      }
      expect(grid.companionLinks.size).toBe(0)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(BASE_TEAM_SIZE)
      expect(getTilesWithCharacters(grid).some((tile) => inTrialBand(tile.characterId!))).toBe(
        false,
      )
    },
  )
})
