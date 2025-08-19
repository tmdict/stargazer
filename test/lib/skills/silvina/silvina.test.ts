import { calculateTarget } from '../../../../src/lib/skills/silvina'
import { Hex } from '../../../../src/lib/hex'
import { FULL_GRID } from '../../../../src/lib/types/grid'
import { Team } from '../../../../src/lib/types/team'
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
  silvinaTile: number
  symmetricalTile: number
  expectedTarget: number
}

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
  
  if (currentTestCase.silvinaTile) {
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
    } else if (file.endsWith('.md') && !file.includes('README') && !file.includes('FORMAT') && !file.includes('format') && !file.includes('RESULTS')) {
      tests.push({
        ...parseTestFile(fullPath),
        path: fullPath.replace(__dirname, '').substring(1)
      })
    }
  }
  
  return tests
}

function loadAllTests(): TestData[] {
  return loadTestsFromDirectory(__dirname)
}


/**
 * Test wrapper for Silvina's calculateTarget function.
 * Creates a mock grid with specified enemy positions and calls the actual implementation.
 */
function runSilvinaTargeting(config: TargetingConfig): TargetingResult {
  const { silvinaTile, enemyTiles, team = Team.ALLY } = config
  
  const opposingTeam = team === Team.ALLY ? Team.ENEMY : Team.ALLY
  
  // Create mock grid for testing
  const mockGrid = {
    getHexById: (id: number) => hexCoordinates.get(id),
    getTileById: (id: number) => {
      if (enemyTiles.includes(id)) {
        return {
          hex: hexCoordinates.get(id),
          characterId: id,
          team: opposingTeam
        }
      }
      return { hex: hexCoordinates.get(id) }
    },
    getAllTiles: () => {
      const tiles: any[] = []
      for (const [id, hex] of hexCoordinates.entries()) {
        if (enemyTiles.includes(id)) {
          tiles.push({ hex, characterId: id, team: opposingTeam })
        } else {
          tiles.push({ hex })
        }
      }
      return tiles
    }
  }
  
  const context = {
    grid: mockGrid,
    team,
    hexId: silvinaTile,
    characterId: 39,
    skillManager: {
      setSkillTarget: () => {},
      clearSkillTarget: () => {}
    }
  } as any
  
  const result = calculateTarget(context)
  
  if (!result || !result.metadata?.symmetricalHexId) {
    throw new Error('No target found')
  }
  
  return {
    symmetricalTile: result.metadata.symmetricalHexId,
    targetTile: result.targetHexId,
    isSymmetricalTarget: result.metadata.isSymmetricalTarget || false
  }
}

/**
 * Simple test runner for Silvina targeting tests
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
  
  for (const testFile of testFiles) {
    const fileDesc = `${testFile.path}`
    
    for (const testCase of testFile.testCases) {
      const testName = `${fileDesc} - Silvina at ${testCase.silvinaTile}`
      
      runner.test(testName, () => {
        const result = runSilvinaTargeting({
          silvinaTile: testCase.silvinaTile,
          enemyTiles: testFile.enemies,
          team: Team.ALLY
        })
        
        expect(
          result.symmetricalTile,
          testCase.symmetricalTile,
          `Symmetrical tile mismatch: expected ${testCase.symmetricalTile}, got ${result.symmetricalTile}`
        )
        
        expect(
          result.targetTile,
          testCase.expectedTarget,
          `Target mismatch: expected ${testCase.expectedTarget}, got ${result.targetTile}`
        )
      })
    }
  }
  
  // Test enemy team behavior (180° rotation)
  runner.test('Enemy Team - Counter-clockwise walk at distance 1', () => {
    const result = runSilvinaTargeting({
      silvinaTile: 44,
      enemyTiles: [2, 6],
      team: Team.ENEMY
    })
    
    expect(result.symmetricalTile, 1, `Symmetrical tile mismatch`)
    expect(result.targetTile, 6, `Should select tile 6 in counter-clockwise walk`)
  })
  
  runner.test('Enemy Team - Counter-clockwise walk at distance 2', () => {
    const result = runSilvinaTargeting({
      silvinaTile: 36,
      enemyTiles: [1, 2, 11, 14, 15],
      team: Team.ENEMY
    })
    
    expect(result.symmetricalTile, 8, `Symmetrical tile mismatch`)
  })
  
  // Run all tests
  await runner.run()
}

runTests().catch(error => {
  console.error('Test runner error:', error)
  process.exit(1)
})