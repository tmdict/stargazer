import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { Team } from '@/lib/types/team'
import { buildScenarioGrid, loadTestsFromDirectory } from './helpers'

/**
 * Fixture-driven verification of Aliceth's ally-targeting chain:
 * same-diagonal-row search first, ring scan outward as the fallback.
 * Each case runs the real skill through the SkillManager; no enemies are
 * placed, so the skill's enemy half stays inert.
 */

const ALICETH = 91

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Aliceth row-scan targeting', () => {
  const testFiles = loadTestsFromDirectory(join(__dirname, 'rowScan'))

  testFiles.forEach((testFile) => {
    describe(`${testFile.path ?? 'unknown fixture'}`, () => {
      testFile.testCases.forEach(({ characterTile, expectedTarget }) => {
        it(`Aliceth at ${characterTile} targets ally ${expectedTarget}`, () => {
          const { grid, skillManager } = buildScenarioGrid(
            testFile.testSetup.arena,
            testFile.testSetup.positions,
            Team.ALLY,
          )

          const casterTile = grid.getTileById(characterTile)
          casterTile.characterId = ALICETH
          casterTile.team = Team.ALLY
          expect(skillManager.activateCharacterSkill(ALICETH, characterTile, Team.ALLY, grid)).toBe(
            true,
          )

          const arrows = skillManager.getSkillTarget(ALICETH, Team.ALLY)?.metadata?.arrows ?? []
          const allyArrows = arrows.filter((a) => a.type === 'ally')
          expect(allyArrows).toHaveLength(1)
          expect(allyArrows[0]!.fromHexId).toBe(characterTile)
          expect(allyArrows[0]!.toHexId).toBe(expectedTarget)
        })
      })
    })
  })
})
