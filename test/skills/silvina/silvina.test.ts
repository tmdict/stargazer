import { getSymmetricalHexId } from '../../../src/lib/skills/utils/symmetry'
import { getTieBreakingPreference } from '../../../src/lib/skills/silvina'
import { Hex } from '../../../src/lib/hex'
import { FULL_GRID } from '../../../src/lib/types/grid'
import { Team } from '../../../src/lib/types/team'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, basename, dirname } from 'path'
import { fileURLToPath } from 'url'

interface TargetingConfig {
  silvinaTile: number
  enemyTiles: number[]
  team?: Team
}

interface TargetingResult {
  symmetricalTile: number | undefined
  targetTile: number
  isSymmetricalTarget: boolean
}

// Build a map of hex IDs to Hex objects
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

// Initialize on module load
initializeHexGrid()

// Test file parsing
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
  silvinaTile: number
  symmetricalTile: number
  expectedTarget: number
}

/**
 * Parse a test file in markdown format
 */
function parseTestFile(filePath: string): TestData {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  const testData: TestData = {
    file: basename(filePath),
    arena: '',
    notes: '',
    enemies: [],
    testCases: []
  }
  
  let inEnemySection = false
  let currentTestCase: Partial<TestCase> = {}
  
  for (const line of lines) {
    // Parse arena
    if (line.startsWith('arena:')) {
      testData.arena = line.replace('arena:', '').trim()
    }
    
    // Parse notes
    if (line.startsWith('notes:')) {
      testData.notes = line.replace('notes:', '').trim()
    }
    
    // Parse enemy positions
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
    
    // Parse test cases
    if (line.startsWith('silvina tile:')) {
      if (currentTestCase.silvinaTile) {
        testData.testCases.push(currentTestCase as TestCase)
      }
      currentTestCase = {
        silvinaTile: parseInt(line.replace('silvina tile:', '').trim())
      }
    }
    
    if (line.startsWith('symmetrical tile:')) {
      currentTestCase.symmetricalTile = parseInt(line.replace('symmetrical tile:', '').trim())
    }
    
    if (line.startsWith('expected target:')) {
      currentTestCase.expectedTarget = parseInt(line.replace('expected target:', '').trim())
    }
  }
  
  // Add the last test case
  if (currentTestCase.silvinaTile) {
    testData.testCases.push(currentTestCase as TestCase)
  }
  
  return testData
}

/**
 * Load all test files from a directory
 */
function loadTestsFromDirectory(dirPath: string): TestData[] {
  const tests: TestData[] = []
  const files = readdirSync(dirPath)
  
  for (const file of files) {
    const fullPath = join(dirPath, file)
    const stat = statSync(fullPath)
    
    if (stat.isDirectory()) {
      // Recursively load tests from subdirectories
      tests.push(...loadTestsFromDirectory(fullPath))
    } else if (file.endsWith('.md') && !file.includes('README') && !file.includes('FORMAT') && !file.includes('format') && !file.includes('RESULTS')) {
      tests.push({
        ...parseTestFile(fullPath),
        path: fullPath.replace(__dirname, '').substring(1)
      })
    }
  }
  
  return tests
}

/**
 * Load all Silvina tests
 */
function loadAllTests(): TestData[] {
  return loadTestsFromDirectory(__dirname)
}

// Get distance between two hex IDs
function getHexDistance(hex1Id: number, hex2Id: number): number {
  const hex1 = hexCoordinates.get(hex1Id)
  const hex2 = hexCoordinates.get(hex2Id)
  
  if (!hex1 || !hex2) {
    throw new Error(`Invalid hex IDs: ${hex1Id}, ${hex2Id}`)
  }
  
  return hex1.distance(hex2)
}

// Silvina targeting algorithm (testing the actual logic)
function runSilvinaTargeting(config: TargetingConfig): TargetingResult {
  const { silvinaTile, enemyTiles, team = Team.ALLY } = config
  
  // Get symmetrical tile using actual function
  const symmetricalTile = getSymmetricalHexId(silvinaTile)
  
  if (!symmetricalTile) {
    throw new Error(`No symmetrical tile found for ${silvinaTile}`)
  }
  
  // Check if an enemy is on the symmetrical tile
  if (enemyTiles.includes(symmetricalTile)) {
    return {
      symmetricalTile,
      targetTile: symmetricalTile,
      isSymmetricalTarget: true
    }
  }
  
  // Calculate distances from symmetrical tile to all enemies
  const enemiesWithDistance = enemyTiles.map(enemyTile => ({
    tile: enemyTile,
    distance: getHexDistance(symmetricalTile, enemyTile)
  }))
  
  // Sort by distance, then apply tie-breaking
  enemiesWithDistance.sort((a, b) => {
    // Primary sort: distance
    if (a.distance !== b.distance) {
      return a.distance - b.distance
    }
    
    // Tie-breaking based on position in DIAGONAL_ROWS
    const preference = getTieBreakingPreference(symmetricalTile, team)
    
    // Simple sorting based on preference
    return preference === 'lower' 
      ? a.tile - b.tile  // Lower hex ID wins
      : b.tile - a.tile  // Higher hex ID wins
  })
  
  return {
    symmetricalTile,
    targetTile: enemiesWithDistance[0].tile,
    isSymmetricalTarget: false
  }
}

// Simple test framework
class TestRunner {
  tests: Array<{ name: string; fn: () => void | Promise<void> }> = []
  passed = 0
  failed = 0
  results: Array<{ name: string; status: string; error?: string }> = []
  
  test(name: string, fn: () => void | Promise<void>) {
    this.tests.push({ name, fn })
  }
  
  async run() {
    console.log('\n🎯 Running Silvina Targeting Tests\n')
    console.log('=' .repeat(60))
    
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
    
    console.log('\n' + '=' .repeat(60))
    console.log('\n📊 Test Results Summary\n')
    this.printSummary()
    
    // Exit with error code if tests failed
    if (this.failed > 0) {
      process.exit(1)
    }
  }
  
  printSummary() {
    // Group results by test file
    const byFile: Record<string, { passed: number; failed: number; tests: typeof this.results }> = {}
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

// Assertion helper
function expect<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`)
  }
}

// Main test execution
async function runTests() {
  const runner = new TestRunner()
  const testFiles = loadAllTests()
  
  console.log(`📁 Loaded ${testFiles.length} test files`)
  
  let totalTestCases = 0
  for (const testFile of testFiles) {
    totalTestCases += testFile.testCases.length
  }
  console.log(`📝 Total test cases: ${totalTestCases}`)
  
  // Run tests for each file
  for (const testFile of testFiles) {
    const fileDesc = `${testFile.path}`
    
    for (const testCase of testFile.testCases) {
      const testName = `${fileDesc} - Silvina at ${testCase.silvinaTile}`
      
      runner.test(testName, () => {
        // Run the targeting algorithm
        const result = runSilvinaTargeting({
          silvinaTile: testCase.silvinaTile,
          enemyTiles: testFile.enemies,
          team: Team.ALLY // Default to ally for these tests
        })
        
        // Verify symmetrical tile calculation
        expect(
          result.symmetricalTile,
          testCase.symmetricalTile,
          `Symmetrical tile mismatch: expected ${testCase.symmetricalTile}, got ${result.symmetricalTile}`
        )
        
        // Verify target selection
        expect(
          result.targetTile,
          testCase.expectedTarget,
          `Target mismatch: expected ${testCase.expectedTarget}, got ${result.targetTile}`
        )
      })
    }
  }
  
  // Run all tests
  await runner.run()
}

// Execute tests
runTests().catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})