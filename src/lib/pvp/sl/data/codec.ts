/* Reads the Supreme League data file (src/content/pvp/sl/sl.bin).
 * The file is the JSON compressed with raw deflate, each byte then combined
 * with a repeatable keystream (mulberry32 from SEED), so it is noise in the
 * browser's network panel. The writer holds the same seed. It deters a casual
 * look, nothing more: this code is public. The decoded data is held here and
 * handed to the page as a plain object, never put in a store or on window. */

import slFileUrl from '@/content/pvp/sl/sl.bin?url'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { TEAM_MODES } from '@/lib/teams/modes'
import type { SlData } from './types'

const SEED = 0x51a7e5ed

// XOR with the keystream, which undoes itself.
function unscramble(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length)
  let s = SEED >>> 0
  for (let i = 0; i < bytes.length; i++) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    out[i] = bytes[i]! ^ ((t ^ (t >>> 14)) & 0xff)
  }
  return out
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumbers = (value: unknown, length?: number): boolean =>
  Array.isArray(value) &&
  value.every((n) => typeof n === 'number') &&
  (length === undefined || value.length === length)

const RESULTS: readonly unknown[] = ['w', 'l', 't']

// A game's entry: this season's ends with its artifact, last season's has none.
const isGame = (value: unknown, withArtifact: boolean): boolean =>
  Array.isArray(value) &&
  value.length === (withArtifact ? 4 : 3) &&
  Number.isInteger(value[0]) &&
  RESULTS.includes(value[1]) &&
  typeof value[2] === 'number' &&
  (!withArtifact || value[3] === null || Number.isInteger(value[3]))

const isFamily = (value: unknown): boolean =>
  isObject(value) &&
  isObject(value.name) &&
  isNumbers(value.core) &&
  Array.isArray(value.swaps) &&
  value.swaps.every((team: unknown) => isNumbers(team, 5)) &&
  Array.isArray(value.perMap) &&
  value.perMap.every((record: unknown) => isNumbers(record, 3))

// One season's part of the file: its games, teams and groups.
const isSeason = (value: unknown, artifacts: 'artifacts' | 'like'): boolean =>
  isObject(value) &&
  isObject(value.sample) &&
  isNumbers([value.sample.matches, value.sample.games, value.sample.players]) &&
  Array.isArray(value.games) &&
  value.games.every((g: unknown) => isGame(g, artifacts === 'artifacts')) &&
  Array.isArray(value.families) &&
  value.families.every(isFamily) &&
  Array.isArray(value.teams) &&
  value.teams.every(
    (t: unknown) =>
      isObject(t) &&
      isNumbers(t.heroes, 5) &&
      isNumbers(t[artifacts]) &&
      Array.isArray(t.placements) &&
      t.placements.length > 0,
  )

const isMap = (value: unknown): boolean => {
  if (!isObject(value) || typeof value.key !== 'string' || !isObject(value.grid)) return false
  const { grid } = value
  return ['ally', 'enemy', 'blocked', 'breakable'].every((zone) => isNumbers(grid[zone]))
}

/* The shape the model, the generator and the pages rely on: a file of another
 * shape (one written for other code, or a page the host served in its place)
 * is refused whole. The levels' prices must cover every level Stargazer
 * offers. */
function isSlData(value: unknown): value is SlData {
  if (!isObject(value) || !isSeason(value, 'artifacts')) return false
  const { prices, before } = value
  return (
    typeof value.season === 'number' &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.maps) &&
    value.maps.length === TEAM_MODES['5v5'].boardCount &&
    value.maps.every(isMap) &&
    typeof value.prior === 'number' &&
    typeof value.alpha === 'number' &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    isObject(value.flex) &&
    isObject(prices) &&
    isNumbers(prices.refinement, attrMax(ATTR_REFINEMENT) + 1) &&
    isObject(prices.paragon) &&
    Object.values(prices.paragon).every((list) => isNumbers(list, attrMax(ATTR_PARAGON) + 1)) &&
    isNumbers(value.order) &&
    (before === undefined ||
      (isSeason(before, 'like') &&
        typeof (before as Record<string, unknown>).season === 'number' &&
        typeof value.beforeUnder === 'number'))
  )
}

export async function decodeSlData(bytes: Uint8Array): Promise<SlData> {
  const stream = new Blob([unscramble(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  const data: unknown = JSON.parse(await new Response(stream).text())
  if (!isSlData(data)) throw new Error('The Supreme League data is not in the expected format')
  return data
}

// Only a load that worked is kept, so a failed one can be tried again.
let loaded: SlData | null = null

export async function loadSlData(): Promise<SlData> {
  if (loaded) return loaded
  const response = await fetch(slFileUrl)
  if (!response.ok) throw new Error(`The Supreme League data answered ${response.status}`)
  loaded = await decodeSlData(new Uint8Array(await response.arrayBuffer()))
  return loaded
}
