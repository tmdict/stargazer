import { readdirSync, readFileSync, statSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { describe, expect, it } from 'vitest'

import type { Grid, GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import type { SkillContext } from '@/lib/skills/skill'
import { rowScan, searchByRow } from '@/lib/skills/utils/ring'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

interface RowScanConfig {
  characterTile: number // The character's position
  targetTiles: number[] // The ally tiles to find
  targetTeam: Team // The team of the targets (always Ally for this test)
  casterTeam: Team // The team of the caster (determines scan order)
}

interface RowScanResult {
  targetTile: number | null
  isRowTarget: boolean // Whether target was found in same row vs ring scan
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

interface TestFile {
  testName: string
  testSetup: {
    arena: string
    team: string
    positions: number[]
    notes?: string
  }
  testCases: {
    characterTile: number
    expectedTarget: number
  }[]
  path?: string
}

function loadTestFile(filePath: string): TestFile {
  const content = readFileSync(filePath, 'utf-8')
  return JSON.parse(content)
}

function loadTestsFromDirectory(dirPath: string): TestFile[] {
  const tests: TestFile[] = []
  const files = readdirSync(dirPath)

  for (const file of files) {
    const fullPath = join(dirPath, file)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      tests.push(...loadTestsFromDirectory(fullPath))
    } else if (file.endsWith('.json')) {
      const testFile = loadTestFile(fullPath)
      testFile.path = fullPath.replace(join(__dirname, 'rowScan'), '').substring(1)
      tests.push(testFile)
    }
  }

  return tests
}

/**
 * Test wrapper for row scan targeting.
 * First tries searchByRow, then falls back to rowScan if no target found.
 */
function runRowScanTargeting(config: RowScanConfig): RowScanResult {
  const { characterTile, targetTiles, targetTeam, casterTeam } = config

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
      const tiles: GridTile[] = []
      for (const [id, hex] of hexCoordinates.entries()) {
        if (targetTiles.includes(id)) {
          tiles.push({
            hex,
            state: targetTeam === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY,
            characterId: id,
            team: targetTeam,
          })
        } else {
          tiles.push({ hex, state: State.DEFAULT })
        }
      }
      return tiles
    },
    getTilesWithCharacters: () => {
      const tiles: GridTile[] = []
      for (const [id, hex] of hexCoordinates.entries()) {
        if (targetTiles.includes(id)) {
          tiles.push({
            hex,
            state: targetTeam === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY,
            characterId: id,
            team: targetTeam,
          })
        }
      }
      return tiles
    },
  } as unknown as Grid

  // Create mock context
  const context: SkillContext = {
    grid: mockGrid,
    team: casterTeam,
    hexId: characterTile,
    characterId: 999, // Mock character ID
    skillManager: {} as never, // Not used in these functions
  }

  // First try searchByRow (same diagonal row targeting)
  const rowResult = searchByRow(context, targetTeam)
  if (rowResult) {
    return {
      targetTile: rowResult.targetHexId,
      isRowTarget: true,
    }
  }

  // If no target in same row, fall back to rowScan (ring expansion)
  const scanResult = rowScan(context, targetTeam)
  return {
    targetTile: scanResult ? scanResult.targetHexId : null,
    isRowTarget: false,
  }
}

describe('Row Scan Targeting Tests', () => {
  const rowScanDir = join(__dirname, 'rowScan')
  const testFiles = loadTestsFromDirectory(rowScanDir)

  // Test each file's test cases
  testFiles.forEach((testFile) => {
    describe(`${testFile.path || 'Unknown test file'}`, () => {
      testFile.testCases.forEach((testCase) => {
        it(`Character at tile ${testCase.characterTile} targets tile ${testCase.expectedTarget}`, () => {
          // Run targeting with ally team (searches high to low hex ID)
          const result = runRowScanTargeting({
            characterTile: testCase.characterTile,
            targetTiles: testFile.testSetup.positions,
            targetTeam: Team.ALLY,
            casterTeam: Team.ALLY,
          })

          expect(result.targetTile).toBe(testCase.expectedTarget)
        })
      })
    })
  })
})
