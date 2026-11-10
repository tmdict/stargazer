// The Formation engine rules page names a list the rules share by its own
// words, and any other after the one unit whose rule reads it. The lists come
// with the data pack, so a pack update can add a list neither names.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { goalList } from '@/lib/placement/goals'
import { decodeSlData } from '@/lib/pvp/data/codec'
import {
  loadAppLocales,
  loadArtifacts,
  loadCharacters,
  loadCharms,
  loadPhantimals,
} from '@/utils/dataLoader'

const { placement } = await decodeSlData(
  readFileSync(new URL('../../../src/pack/pvp/pvp.bin', import.meta.url)),
)

const rules = [
  ...loadCharacters().filter((hero) => !hero.placeholder),
  ...loadArtifacts(),
  ...loadPhantimals(),
  ...loadCharms(),
].flatMap((unit) => unit.rules ?? [])

describe('placement lists', () => {
  it('each have a name: words of their own, or the one rule that reads them', () => {
    const words = loadAppLocales()
    const unnamed = Object.keys(placement.lists).filter(
      (name) =>
        !words[`rules-list-${name}`] &&
        rules.filter((rule) => goalList(rule.goal) === name).length !== 1,
    )
    expect(unnamed).toEqual([])
    const named = Object.keys(words).filter((key) => /^rules-list-/.test(key))
    const lists = Object.keys(placement.lists).map((name) => `rules-list-${name}`)
    expect(named.filter((key) => !lists.includes(key))).toEqual([])
  })

  // The engine leaves out a rule whose list or weight the data pack lacks,
  // without a word, while the rules page still shows it.
  it('and the weights hold everything a rule names', () => {
    const missing = rules.flatMap((rule) => {
      const list = goalList(rule.goal)
      return [
        ...(list !== undefined && !placement.lists[list] ? [`list ${list}`] : []),
        ...(rule.weight !== undefined && placement.weights[rule.weight] === undefined
          ? [`weight ${rule.weight}`]
          : []),
      ]
    })
    expect(missing).toEqual([])
  })
})
