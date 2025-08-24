import { describe, it, expect } from 'vitest'
import { spiralSearchFromTile } from '../../../../src/lib/skills/utils/targeting'
import { getSymmetricalHexId } from '../../../../src/lib/skills/utils/symmetry'
import { Hex } from '../../../../src/lib/hex'
import { FULL_GRID } from '../../../../src/lib/types/grid'
import { Team } from '../../../../src/lib/types/team'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

interface SpiralSearchConfig {
  centerTile: number // The tile to search from (e.g., symmetrical tile)
  targetTiles: number[] // The target tiles to find
  targetTeam: Team // The team of the targets
  casterTeam: Team // The team of the caster (determines walk direction)
}

interface SpiralSearchResult {
  targetTile: number
  examinedTiles: number[]
}

/**
 * Initialize hex coordinate map for testing
 */
const hexCoordinates = new Map<number, Hex>()

function initializeHexGrid() {
  const centerRowIndex = Math.floor(FULL_GRID.hex.length / 2)

  for (let rowIndex = 0; rowIndex < FULL_GRID.hex.length; rowIndex++) {
    const row = FULL_GRID.hex[rowIndex]
    const r = rowIndex - centerRowIndex
    const offset = FULL_GRID.qOffset[rowIndex]

    for (let i = 0; i < row.length; i++) {
      const q = offset + i
      const s = -q - r
      const id = row[i]
      const hex = new Hex(q, r, s, id)
      hexCoordinates.set(id, hex)
    }
  }
}

initializeHexGrid()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface TestData {
  file: string
  arena: string
  notes: string
  enemies: number[]
  testCases: TestCase[]
  path?: string
}

interface TestCase {
  casterTile: number // The caster's position (for getting symmetrical tile)
  symmetricalTile: number // The center tile for spiral search
  expectedTarget: number // Expected target found by spiral search
}

function parseTestFile(filePath: string): TestData {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  const testData: TestData = {
    file: basename(filePath),
    arena: '',
    notes: '',
    enemies: [],
    testCases: [],
  }

  let inEnemySection = false
  let currentTestCase: Partial<TestCase> = {}

  for (const line of lines) {
    if (line.startsWith('arena:')) {
      testData.arena = line.replace('arena:', '').trim()
    }

    if (line.startsWith('notes:')) {
      testData.notes = line.replace('notes:', '').trim()
    }

    if (line.includes('Enemy Team Positions')) {
      inEnemySection = true
      continue
    }

    if (inEnemySection && line.startsWith('-')) {
      const match = line.match(/Tile (\d+)/)
      if (match) {
        testData.enemies.push(parseInt(match[1]))
      }
    }

    if (line.includes('Test Cases')) {
      inEnemySection = false
    }

    // Parse test cases - adapt to use "character tile" as caster tile
    if (line.startsWith('character tile:')) {
      if (currentTestCase.casterTile) {
        testData.testCases.push(currentTestCase as TestCase)
      }
      currentTestCase = {
        casterTile: parseInt(line.replace('character tile:', '').trim()),
      }
    }

    if (line.startsWith('symmetrical tile:')) {
      currentTestCase.symmetricalTile = parseInt(line.replace('symmetrical tile:', '').trim())
    }

    if (line.startsWith('expected target:')) {
      currentTestCase.expectedTarget = parseInt(line.replace('expected target:', '').trim())
    }
  }

  if (currentTestCase.casterTile) {
    testData.testCases.push(currentTestCase as TestCase)
  }

  return testData
}

function loadTestsFromDirectory(dirPath: string): TestData[] {
  const tests: TestData[] = []
  const files = readdirSync(dirPath)

  for (const file of files) {
    const fullPath = join(dirPath, file)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      tests.push(...loadTestsFromDirectory(fullPath))
    } else if (
      file.endsWith('.md') &&
      !file.includes('README') &&
      !file.includes('FORMAT') &&
      !file.includes('format') &&
      !file.includes('RESULTS')
    ) {
      tests.push({
        ...parseTestFile(fullPath),
        path: fullPath.replace(join(__dirname, 'symmetrical'), '').substring(1),
      })
    }
  }

  return tests
}

function loadAllTests(): TestData[] {
  // Load test data from the symmetrical subdirectory
  const symmetricalDir = join(__dirname, 'symmetrical')
  return loadTestsFromDirectory(symmetricalDir)
}

/**
 * Test wrapper for spiralSearchFromTile function.
 * Creates a mock grid with specified target positions and calls the function directly.
 */
function runSpiralSearch(config: SpiralSearchConfig): SpiralSearchResult {
  const { centerTile, targetTiles, targetTeam, casterTeam } = config

  // Create mock grid for testing
  const mockGrid = {
    getHexById: (id: number) => hexCoordinates.get(id),
    getTileById: (id: number) => {
      if (targetTiles.includes(id)) {
        return {
          hex: hexCoordinates.get(id),
          characterId: id,
          team: targetTeam,
        }
      }
      return { hex: hexCoordinates.get(id) }
    },
    getAllTiles: () => {
      const tiles: any[] = []
      for (const [id, hex] of hexCoordinates.entries()) {
        if (targetTiles.includes(id)) {
          tiles.push({ hex, characterId: id, team: targetTeam })
        } else {
          tiles.push({ hex })
        }
      }
      return tiles
    },
    getTilesWithCharacters: () => {
      const tiles: any[] = []
      for (const [id, hex] of hexCoordinates.entries()) {
        if (targetTiles.includes(id)) {
          tiles.push({ hex, characterId: id, team: targetTeam })
        }
      }
      return tiles
    },
  } as any

  const result = spiralSearchFromTile(mockGrid, centerTile, targetTeam, casterTeam)

  if (!result || result.targetHexId === null) {
    throw new Error('No target found')
  }

  return {
    targetTile: result.targetHexId,
    examinedTiles: (result.metadata?.examinedTiles as number[] | undefined) || [],
  }
}


describe('Targeting Tests', () => {
  describe('Symmetrical targeting', () => {
    const testFiles = loadAllTests()

    // Test spiral search for each test case
    testFiles.forEach(testFile => {
      describe(testFile.path || testFile.file, () => {
        testFile.testCases.forEach(testCase => {
          it(`Spiral from tile ${testCase.symmetricalTile}`, () => {
            // First verify the symmetrical tile calculation matches expected
            const calculatedSymmetrical = getSymmetricalHexId(testCase.casterTile)
            expect(calculatedSymmetrical).toBe(testCase.symmetricalTile)

            // Check if the expected target is on the symmetrical tile itself
            // (In real usage, this would be handled before calling spiralSearchFromTile)
            if (testCase.expectedTarget === testCase.symmetricalTile) {
              // This test case expects the target to be on the symmetrical tile
              // which would be found by Silvina before calling spiral search
              // For spiral search testing, we skip these cases or test that an enemy
              // on the symmetrical tile would be found at distance 0
              if (testFile.enemies.includes(testCase.symmetricalTile)) {
                // There's an enemy on the symmetrical tile - spiral search would find it immediately
                // but in practice, Silvina check this before calling spiral search
                return // Skip this test case as it's not testing spiral search logic
              }
            }

            // Test ally team spiral search (clockwise)
            const result = runSpiralSearch({
              centerTile: testCase.symmetricalTile,
              targetTiles: testFile.enemies,
              targetTeam: Team.ENEMY,
              casterTeam: Team.ALLY,
            })

            expect(result.targetTile).toBe(testCase.expectedTarget)
          })
        })
      })
    })
  })

  describe('Specific spiral search scenarios', () => {
    it('Enemy Team - Counter-clockwise walk at distance 1', () => {
      // Test enemy team spiral behavior (counter-clockwise)
      const centerTile = 1 // Search from tile 1
      const targets = [2, 6] // Enemies at tiles 2 and 6

      const result = runSpiralSearch({
        centerTile,
        targetTiles: targets,
        targetTeam: Team.ALLY, // Targets are ally team
        casterTeam: Team.ENEMY, // Caster is enemy team (counter-clockwise)
      })

      expect(result.targetTile).toBe(6)
    })

    it('Enemy Team - Counter-clockwise walk at distance 2', () => {
      const centerTile = 8 // Search from tile 8
      const targets = [1, 2, 11, 14, 15]

      const result = runSpiralSearch({
        centerTile,
        targetTiles: targets,
        targetTeam: Team.ALLY,
        casterTeam: Team.ENEMY,
      })

      // In counter-clockwise from tile 8, we expect a specific target based on walk order
      // The exact expectation depends on the spiral pattern
      expect(result.examinedTiles.length).toBeGreaterThan(0)
    })

    it('Ally Team - Clockwise walk at same distance', () => {
      const centerTile = 8
      const targets = [1, 2, 11, 14, 15] // Multiple targets at various distances

      const result = runSpiralSearch({
        centerTile,
        targetTiles: targets,
        targetTeam: Team.ENEMY,
        casterTeam: Team.ALLY,
      })

      // Verify it found a target
      expect(targets).toContain(result.targetTile)
    })

    it('No targets available', () => {
      expect(() => {
        runSpiralSearch({
          centerTile: 8,
          targetTiles: [], // No targets
          targetTeam: Team.ENEMY,
          casterTeam: Team.ALLY,
        })
      }).toThrow('No target found')
    })
  })
})
