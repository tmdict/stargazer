import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { getSymmetricalHexId } from '@/lib/skills/utils/symmetry'
import { Team } from '@/lib/types/team'
import { buildScenarioGrid, loadTestsFromDirectory } from './helpers'

/**
 * Fixture-driven verification of Silvina's full targeting chain:
 *   1. enemy on the symmetrical tile is targeted directly
 *   2. otherwise the nearest enemy to the symmetrical tile wins via spiral search
 * Each case runs the real skill through the SkillManager on the fixture's arena.
 */

const SILVINA = 39

const __dirname = dirname(fileURLToPath(import.meta.url))

describe('Silvina symmetrical targeting', () => {
  const testFiles = loadTestsFromDirectory(join(__dirname, 'symmetricalSpiral'))

  testFiles.forEach((testFile) => {
    describe(`${testFile.path ?? 'unknown fixture'}`, () => {
      testFile.testCases.forEach(({ characterTile, symmetricalTile, expectedTarget }) => {
        it(`Silvina at ${characterTile} targets ${expectedTarget}`, () => {
          const { grid, skillManager } = buildScenarioGrid(
            testFile.testSetup.arena,
            testFile.testSetup.positions,
            Team.ENEMY,
          )

          expect(getSymmetricalHexId(grid, characterTile)).toBe(symmetricalTile)

          const casterTile = grid.getTileById(characterTile)
          casterTile.characterId = SILVINA
          casterTile.team = Team.ALLY
          expect(skillManager.activateCharacterSkill(SILVINA, characterTile, Team.ALLY, grid)).toBe(
            true,
          )

          const target = skillManager.getSkillTarget(SILVINA, Team.ALLY)
          expect(target?.targetHexId).toBe(expectedTarget)
          // The direct symmetrical hit and the spiral fallback must agree
          // with where the expected target actually sits
          expect(target?.metadata?.isSymmetricalTarget).toBe(expectedTarget === symmetricalTile)
        })
      })
    })
  })
})
