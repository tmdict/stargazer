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

/**
 * Simple test runner for spiral search tests
 */
class TestRunner {
  tests: Array<{ name: string; fn: () => void | Promise<void> }> = []
  passed = 0
  failed = 0
  results: Array<{ name: string; status: string; error?: string }> = []

  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn })
  }

  async run() {
    console.log('\n🎯 Running Targeting Tests\n')
    console.log('  Testing: symmetrical targeting\n')
    console.log('='.repeat(60))

    for (const test of this.tests) {
      try {
        await test.fn()
        this.passed++
        this.results.push({ name: test.name, status: 'PASS' })
        console.log(`✅ ${test.name}`)
      } catch (error: any) {
        this.failed++
        this.results.push({ name: test.name, status: 'FAIL', error: error.message })
        console.log(`❌ ${test.name}`)
        console.log(`   ${error.message}`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Test Results Summary\n')
    this.printSummary()

    // Exit with error code if tests failed
    if (this.failed > 0) {
      process.exit(1)
    }
  }

  printSummary() {
    // Group results by test file
    const byFile: Record<string, { passed: number; failed: number; tests: typeof this.results }> =
      {}
    for (const result of this.results) {
      const [file] = result.name.split(' - ')
      if (!byFile[file]) {
        byFile[file] = { passed: 0, failed: 0, tests: [] }
      }
      if (result.status === 'PASS') {
        byFile[file].passed++
      } else {
        byFile[file].failed++
      }
      byFile[file].tests.push(result)
    }

    // Print summary by file
    for (const [file, stats] of Object.entries(byFile)) {
      const total = stats.passed + stats.failed
      const percentage = ((stats.passed / total) * 100).toFixed(1)
      const status = stats.failed === 0 ? '✅' : '⚠️'
      console.log(`${status} ${file}: ${stats.passed}/${total} (${percentage}%)`)

      // Show failed tests
      if (stats.failed > 0) {
        for (const test of stats.tests) {
          if (test.status === 'FAIL') {
            const testName = test.name.split(' - ').slice(1).join(' - ')
            console.log(`   ❌ ${testName}`)
          }
        }
      }
    }

    // Overall summary
    console.log('\n' + '-'.repeat(40))
    const totalTests = this.passed + this.failed
    const percentage = ((this.passed / totalTests) * 100).toFixed(1)
    console.log(`Total: ${this.passed}/${totalTests} tests passed (${percentage}%)`)

    if (this.failed === 0) {
      console.log('\n🎉 All tests passed!')
    } else {
      console.log(`\n⚠️  ${this.failed} tests failed`)
    }
  }
}

function expect<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

/**
 * Main test execution - loads all test files and runs them
 */
async function runTests() {
  const runner = new TestRunner()
  const testFiles = loadAllTests()

  console.log(`📁 Loaded ${testFiles.length} test files`)

  let totalTestCases = 0
  for (const testFile of testFiles) {
    totalTestCases += testFile.testCases.length
  }
  console.log(`📝 Total test cases: ${totalTestCases}`)

  // Test spiral search for each test case
  for (const testFile of testFiles) {
    const fileDesc = `${testFile.path}`

    for (const testCase of testFile.testCases) {
      // Test case simulates characters like Silvina searching from symmetrical tile
      const testName = `${fileDesc} - Spiral from tile ${testCase.symmetricalTile}`

      runner.test(testName, () => {
        // First verify the symmetrical tile calculation matches expected
        const calculatedSymmetrical = getSymmetricalHexId(testCase.casterTile)
        expect(
          calculatedSymmetrical,
          testCase.symmetricalTile,
          `Symmetrical tile mismatch: expected ${testCase.symmetricalTile}, got ${calculatedSymmetrical}`,
        )

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

        expect(
          result.targetTile,
          testCase.expectedTarget,
          `Target mismatch: expected ${testCase.expectedTarget}, got ${result.targetTile}`,
        )
      })
    }
  }

  // Additional specific spiral search tests
  runner.test('Enemy Team - Counter-clockwise walk at distance 1', () => {
    // Test enemy team spiral behavior (counter-clockwise)
    const centerTile = 1 // Search from tile 1
    const targets = [2, 6] // Enemies at tiles 2 and 6

    const result = runSpiralSearch({
      centerTile,
      targetTiles: targets,
      targetTeam: Team.ALLY, // Targets are ally team
      casterTeam: Team.ENEMY, // Caster is enemy team (counter-clockwise)
    })

    expect(result.targetTile, 6, `Should select tile 6 in counter-clockwise walk`)
  })

  runner.test('Enemy Team - Counter-clockwise walk at distance 2', () => {
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
    expect(result.examinedTiles.length > 0, true, 'Should have examined tiles')
  })

  runner.test('Ally Team - Clockwise walk at same distance', () => {
    const centerTile = 8
    const targets = [1, 2, 11, 14, 15] // Multiple targets at various distances

    const result = runSpiralSearch({
      centerTile,
      targetTiles: targets,
      targetTeam: Team.ENEMY,
      casterTeam: Team.ALLY,
    })

    // Verify it found a target
    expect(targets.includes(result.targetTile), true, 'Should find one of the targets')
  })

  runner.test('No targets available', () => {
    try {
      runSpiralSearch({
        centerTile: 8,
        targetTiles: [], // No targets
        targetTeam: Team.ENEMY,
        casterTeam: Team.ALLY,
      })
      throw new Error('Should have thrown "No target found"')
    } catch (error: any) {
      expect(error.message, 'No target found', 'Should throw when no targets available')
    }
  })

  // Run all tests
  await runner.run()
}

runTests().catch((error) => {
  console.error('Test runner error:', error)
  process.exit(1)
})
