import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { Grid } from '@/lib/grid'
import { MAPS } from '@/lib/maps'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'

/**
 * Shared harness for the data-driven targeting suites. Fixtures record real
 * in-game scenarios: an arena, a set of target positions, and per-case
 * caster tiles with the expected target.
 */

export interface TargetingTestFile {
  testName: string
  testSetup: {
    arena: string // roman numeral, e.g. "I" → arena1
    team: string
    positions: number[]
    notes?: string
  }
  testCases: {
    characterTile: number
    symmetricalTile?: number
    expectedTarget: number
  }[]
  path?: string
}

const ROMAN_TO_ARENA: Record<string, string> = {
  I: 'arena1',
  II: 'arena2',
  III: 'arena3',
  IV: 'arena4',
  V: 'arena5',
}

export function loadTestsFromDirectory(dirPath: string, rootDir = dirPath): TargetingTestFile[] {
  const tests: TargetingTestFile[] = []

  for (const file of readdirSync(dirPath)) {
    const fullPath = join(dirPath, file)
    if (statSync(fullPath).isDirectory()) {
      tests.push(...loadTestsFromDirectory(fullPath, rootDir))
    } else if (file.endsWith('.json')) {
      const testFile: TargetingTestFile = JSON.parse(readFileSync(fullPath, 'utf-8'))
      testFile.path = fullPath.slice(rootDir.length + 1)
      tests.push(testFile)
    }
  }

  return tests
}

/**
 * Build a real Grid on the fixture's arena with targets placed by direct
 * tile assignment (targeting reads only characterId/team; arena placement
 * zones don't constrain recorded positions).
 */
export function buildScenarioGrid(
  arena: string,
  targetHexIds: number[],
  targetTeam: Team,
): { grid: Grid; skillManager: SkillManager } {
  const map = MAPS[ROMAN_TO_ARENA[arena] ?? 'arena1']
  const grid = new Grid(undefined, map)
  const skillManager = new SkillManager()
  grid.skillManager = skillManager

  for (const hexId of targetHexIds) {
    const tile = grid.getTileById(hexId)
    tile.characterId = 1000 + hexId
    tile.team = targetTeam
  }

  return { grid, skillManager }
}
