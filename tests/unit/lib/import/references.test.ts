import { describe, expect, it, vi } from 'vitest'

import { DESCRIPTOR_LENGTH, encodeLearned, rankHeroes } from '@/lib/import/heroes'
import { readLearnedIcons, serializeLearnedIcons } from '@/lib/import/learned'
import { buildImportHeroTable } from '@/lib/import/references'
import type { LearnedIcon } from '@/lib/import/types'
import { createImage } from '../../fixtures/image'

vi.mock('@/data/import/hero-icons.json', async () => {
  const { DESCRIPTOR_LENGTH, encodeLearned } = await import('@/lib/import/heroes')
  const { serializeLearnedIcons } = await import('@/lib/import/learned')
  const descriptor = encodeLearned(new Float32Array(DESCRIPTOR_LENGTH).fill(0.02))
  return {
    default: JSON.parse(serializeLearnedIcons([{ characterId: 7, descriptor, learnedAt: 1 }])),
  }
})

const face = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
const icon: LearnedIcon = { characterId: 7, descriptor: encodeLearned(face), learnedAt: 1 }
const portraits = [7, 9].map((characterId) => ({ characterId, image: createImage(180, 248) }))

describe('curated hero references', () => {
  it('keeps curated matches when browser learning is cleared, without duplicating promoted examples', () => {
    const other = {
      ...icon,
      characterId: 9,
      descriptor: encodeLearned(new Float32Array(DESCRIPTOR_LENGTH).fill(-0.02)),
    }
    const local = [icon, other]
    const table = buildImportHeroTable(portraits, local)
    const learnedIds = (result: typeof table) =>
      Array.from(result.ids).filter((_, i) => result.learnedRows[i] === 1)
    expect(learnedIds(table)).toEqual([7, 9])

    const cleared = buildImportHeroTable(portraits, [])
    expect(learnedIds(cleared)).toEqual([7])
    expect(rankHeroes(cleared, [face])[0]).toMatchObject({ characterId: 7, learned: true })
    expect(local).toEqual([icon, other])
  })

  it('lets a local correction override the same curated face until local learning is cleared', () => {
    const table = buildImportHeroTable(portraits, [{ ...icon, characterId: 9 }])
    expect(rankHeroes(table, [face])[0]).toMatchObject({ characterId: 9, learned: true })
    expect(rankHeroes(buildImportHeroTable(portraits), [face])[0]).toMatchObject({
      characterId: 7,
      learned: true,
    })
  })

  it('excludes descriptors for heroes absent from the loaded hero list', () => {
    const table = buildImportHeroTable(portraits, [{ ...icon, characterId: 999 }])
    expect(Array.from(table.ids)).not.toContain(999)
  })

  it('ships a reference file compatible with the descriptor contract', async () => {
    const { default: data } = await vi.importActual<{ default: unknown }>(
      '@/data/import/hero-icons.json',
    )
    const icons = readLearnedIcons(data)
    expect(data).toEqual(JSON.parse(serializeLearnedIcons(icons)))
    expect(new Set(icons.map((icon) => icon.descriptor)).size).toBe(icons.length)
    const heroes = Object.values(
      import.meta.glob<{ id: number }>('@/data/character/*.json', {
        eager: true,
        import: 'default',
      }),
    )
    for (const icon of icons) expect(heroes.some((hero) => hero.id === icon.characterId)).toBe(true)
  })
})
