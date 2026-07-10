import { beforeEach, describe, expect, it } from 'vitest'

import { addCompanionLink } from '@/lib/characters/companion'
import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const ELIJAH = 68
// Cells 1, 4, 7, 10, 14 share a hex axis (q = -3), each one step apart.
const ELIJAH_HEX = 1
const COMPANION_HEX = 10 // between: 4, 7
const FAR_COMPANION = 14 // between: 4, 7, 10 — room for multi-segment cases
const [BETWEEN_A, BETWEEN_B] = [4, 7]

describe('elijah-lailah between-tile borders and connection line', () => {
  let grid: Grid
  let skillManager: SkillManager
  let factions: Map<number, string>

  const buildContext = (): SkillContext => ({
    grid,
    hexId: ELIJAH_HEX,
    team: Team.ALLY,
    characterId: ELIJAH,
    skillManager,
    lookups: { factionOf: (id) => factions.get(id) },
  })

  // Place the twins collinearly and link them, without the random companion spawn
  // so the span between them is deterministic.
  const placeTwins = (companionHex = COMPANION_HEX) => {
    const companionId = grid.companionIdOffset + ELIJAH
    placeOnTile(grid, ELIJAH_HEX, ELIJAH, Team.ALLY)
    placeOnTile(grid, companionHex, companionId, Team.ALLY)
    addCompanionLink(grid, ELIJAH, companionId, Team.ALLY)
  }

  const runSkill = () => getCharacterSkill(ELIJAH)!.onUpdate!(buildContext())

  const removeUnit = (hexId: number) => {
    grid.getTileById(hexId).characterId = undefined
    grid.getTileById(hexId).team = undefined
  }

  const lineSegments = () =>
    skillManager.getSkillLines().map((line) => ({ from: line.fromHexId, to: line.toHexId }))

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    factions = new Map()
  })

  // --- tile borders ---

  it('borders only the tiles of allies sandwiched between the twins', () => {
    placeTwins()
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY)

    runSkill()

    expect(skillManager.getTileColorModifier(BETWEEN_A)).toBeDefined()
    expect(skillManager.getTileColorModifier(BETWEEN_B)).toBeUndefined() // empty cell
  })

  it('borders nothing when the twins are not on a shared axis', () => {
    placeTwins(45) // shares no coordinate with cell 1
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY)

    runSkill()

    expect(skillManager.getTileColorModifier(BETWEEN_A)).toBeUndefined()
  })

  it('clears a border once its ally leaves the line', () => {
    placeTwins()
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY)
    runSkill()
    expect(skillManager.getTileColorModifier(BETWEEN_A)).toBeDefined()

    removeUnit(BETWEEN_A)
    runSkill()

    expect(skillManager.getTileColorModifier(BETWEEN_A)).toBeUndefined()
  })

  // The colors themselves are design constants; assert the faction-driven *choice*
  // by comparing runtime values, not literals (shared/lone vs mixed).
  it('colors the border by faction: shared and lone allies differ from a mixed set', () => {
    placeTwins()
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY)
    placeOnTile(grid, BETWEEN_B, 101, Team.ALLY)

    factions.set(100, 'wilder')
    factions.set(101, 'wilder')
    runSkill()
    const shared = skillManager.getTileColorModifier(BETWEEN_A)![0]

    factions.set(101, 'mauler')
    runSkill()
    const mixed = skillManager.getTileColorModifier(BETWEEN_A)![0]

    removeUnit(BETWEEN_B)
    runSkill()
    const lone = skillManager.getTileColorModifier(BETWEEN_A)![0]

    expect(shared).not.toBe(mixed)
    expect(lone).toBe(shared)
  })

  // --- connection line ---

  it('draws one full-span line when nothing is between the twins', () => {
    placeTwins()

    runSkill()

    expect(lineSegments()).toEqual([{ from: ELIJAH_HEX, to: COMPANION_HEX }])
  })

  it('skips a sandwiched character, drawing over the empty cells on both sides', () => {
    placeTwins(FAR_COMPANION)
    placeOnTile(grid, BETWEEN_B, 100, Team.ALLY) // cell 7; 4 and 10 empty

    runSkill()

    expect(lineSegments()).toEqual([
      { from: ELIJAH_HEX, to: BETWEEN_B }, // over cell 4
      { from: BETWEEN_B, to: FAR_COMPANION }, // over cell 10
    ])
  })

  it('skips any character between, ally or not, without bordering non-allies', () => {
    placeTwins(FAR_COMPANION)
    placeOnTile(grid, BETWEEN_B, 200, Team.ENEMY) // cell 7

    runSkill()

    expect(lineSegments()).toEqual([
      { from: ELIJAH_HEX, to: BETWEEN_B },
      { from: BETWEEN_B, to: FAR_COMPANION },
    ])
    expect(skillManager.getTileColorModifier(BETWEEN_B)).toBeUndefined()
  })

  it('still segments between adjacent icons (the icons leave a small gap)', () => {
    placeTwins() // companion at 10; between 4, 7
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY) // cell 4, adjacent to Elijah

    runSkill()

    // Short segment in the gap between Elijah and the ally, then over empty cell 7.
    expect(lineSegments()).toEqual([
      { from: ELIJAH_HEX, to: BETWEEN_A },
      { from: BETWEEN_A, to: COMPANION_HEX },
    ])
  })

  it('segments between every icon when the column is fully packed', () => {
    placeTwins() // companion at 10; between 4, 7
    placeOnTile(grid, BETWEEN_A, 100, Team.ALLY)
    placeOnTile(grid, BETWEEN_B, 101, Team.ALLY)

    runSkill()

    expect(lineSegments()).toEqual([
      { from: ELIJAH_HEX, to: BETWEEN_A },
      { from: BETWEEN_A, to: BETWEEN_B },
      { from: BETWEEN_B, to: COMPANION_HEX },
    ])
  })

  it('draws no line when the twins are not on a shared axis', () => {
    placeTwins(45)

    runSkill()

    expect(skillManager.getSkillLines()).toEqual([])
  })

  it('draws the line in the same color as the borders', () => {
    placeTwins(FAR_COMPANION)
    placeOnTile(grid, BETWEEN_B, 100, Team.ALLY)
    factions.set(100, 'wilder')

    runSkill()

    const borderColor = skillManager.getTileColorModifier(BETWEEN_B)![0]
    const lines = skillManager.getSkillLines()
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((line) => line.color === borderColor)).toBe(true)
  })

  it('removes the line on deactivate', () => {
    placeTwins()
    const ctx = buildContext()
    getCharacterSkill(ELIJAH)!.onUpdate!(ctx)
    expect(skillManager.getSkillLines()).toHaveLength(1)

    getCharacterSkill(ELIJAH)!.onDeactivate(ctx)

    expect(skillManager.getSkillLines()).toEqual([])
  })
})
