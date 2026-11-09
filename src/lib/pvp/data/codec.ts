/* Reads the PvP data file (pvp/pvp.bin in the data pack).
 * The file is the JSON compressed with raw deflate, then encrypted with AES-GCM,
 * so it is noise in the browser's network panel. The key comes from pvp/pvp.key,
 * new with each export, and the repository holds neither. It deters a casual
 * look, nothing more: Vite writes pvp.key into this script, which every visitor
 * downloads. The decoded data is held here and handed to the page as a plain
 * object, never put in a store or on window. */

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { CLASS_ORDER } from '@/lib/filterOrder'
import { MAPS } from '@/lib/maps'
import pvpFileUrl from '@/pack/pvp/pvp.bin?url'
import pvpKey from '@/pack/pvp/pvp.key?raw'
import type { SlData, SlMap } from './types'

// The writer combines pvp.key with the same text, so what the script stores is
// not itself the key.
const KEY_MIX = 'stargazer-pvp'

async function decrypt(file: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const material = new TextEncoder().encode(`${pvpKey.trim()}${KEY_MIX}`)
  const digest = await crypto.subtle.digest('SHA-256', material)
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
  // The file opens with the cipher's 12-byte starting value.
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: file.subarray(0, 12) },
    key,
    file.subarray(12),
  )
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isNumbers = (value: unknown, length?: number): boolean =>
  Array.isArray(value) &&
  value.every((n) => typeof n === 'number') &&
  (length === undefined || value.length === length)
const isNumberRecord = (value: unknown): boolean =>
  isObject(value) && Object.values(value).every((n) => typeof n === 'number')
const isIndex = (value: unknown, length: number): boolean =>
  Number.isInteger(value) && (value as number) >= 0 && (value as number) < length

const isFamily = (value: unknown): boolean =>
  isObject(value) &&
  isObject(value.name) &&
  isNumbers(value.core) &&
  Array.isArray(value.swaps) &&
  value.swaps.every((team: unknown) => isNumbers(team, 5))

const isPick = (value: unknown, placements: number): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  (value[0] === null || Number.isInteger(value[0])) &&
  isIndex(value[1], placements)

const isTeam = (t: unknown, families: number): t is Record<string, unknown> =>
  isObject(t) &&
  isNumbers(t.heroes, 5) &&
  (t.family === null || isIndex(t.family, families)) &&
  isNumbers([t.rank, t.decided, t.wins, t.games, t.players]) &&
  Array.isArray(t.artifacts) &&
  t.artifacts.every((row: unknown) => isNumbers(row, 2))

const isMapTeam = (t: unknown, families: number): boolean =>
  isTeam(t, families) &&
  Array.isArray(t.placements) &&
  (t.pick === undefined ||
    (Array.isArray(t.pick) &&
      t.pick.every((pick: unknown) => isPick(pick, (t.placements as unknown[]).length)))) &&
  (t.record === undefined || (t.family === null && isNumbers(t.record, 3)))

const isMap = (value: unknown, families: number): boolean =>
  isObject(value) &&
  typeof value.key === 'string' &&
  Object.hasOwn(MAPS, value.key) &&
  isNumberRecord(value.pickRates) &&
  Array.isArray(value.records) &&
  value.records.length === families &&
  value.records.every((record: unknown) => isNumbers(record, 3)) &&
  Array.isArray(value.teams) &&
  value.teams.every((t: unknown) => isMapTeam(t, families))

const isEvidence = (value: unknown): boolean =>
  isObject(value) &&
  isNumbers([value.groupGames, value.players, value.games, value.wins]) &&
  typeof value.oneOffs === 'boolean'

const isRows = (value: unknown, length: number): boolean =>
  isObject(value) && Object.values(value).every((row) => isNumbers(row, length))

// A hero's row carries its number against the field after its record, so it
// is one longer than the others.
const isModel = (value: unknown): boolean =>
  isObject(value) &&
  isNumbers([value.gap, value.emptySlot, value.typicalHeroes, value.typicalArtifact]) &&
  isNumberRecord(value.fieldAgainst) &&
  isRows(value.heroes, 4) &&
  isRows(value.lineups, 3) &&
  isRows(value.counters, 3) &&
  isRows(value.artifacts, 3) &&
  isRows(value.artifactsOnKind, 3)

const HERO_FILTER_KEYS = new Set(['class', 'range', 'damage'])

const isHeroFilter = (value: unknown): boolean =>
  isObject(value) &&
  Object.keys(value).every((key) => HERO_FILTER_KEYS.has(key)) &&
  (value.class === undefined ||
    (Array.isArray(value.class) &&
      value.class.length > 0 &&
      value.class.every((name: unknown) => CLASS_ORDER.includes(name as string)))) &&
  (value.range === undefined || value.range === 'melee' || value.range === 'ranged') &&
  (value.damage === undefined || value.damage === 'physical' || value.damage === 'magic')

const isListEntry = (value: unknown): boolean =>
  Number.isInteger(value) ||
  (isObject(value) &&
    (typeof value.list === 'string' || value.line === true || isHeroFilter(value.every)))

const isPlacementData = (value: unknown): boolean =>
  isObject(value) &&
  isObject(value.lists) &&
  Object.values(value.lists).every((list) => Array.isArray(list) && list.every(isListEntry)) &&
  isObject(value.leans) &&
  isNumbers(value.leans.front) &&
  isNumbers(value.leans.back) &&
  isNumberRecord(value.weights)

const isSeasons = (value: unknown, live: unknown): boolean =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (s: unknown) =>
      isObject(s) &&
      isNumbers([s.season, s.weight]) &&
      isObject(s.sample) &&
      isNumbers([s.sample.matches, s.sample.games, s.sample.players]),
  ) &&
  value[0].season === live &&
  value[0].weight === 1

/* The shape the reader, the generator and the pages rely on: a file of another
 * shape (one written for other code, or a page the host served in its place)
 * is refused whole. The levels' prices must cover every level Stargazer
 * offers, and every map it names must be one of Stargazer's, once. */
function isSlData(value: unknown): value is SlData {
  if (!isObject(value) || !Array.isArray(value.families) || !value.families.every(isFamily)) {
    return false
  }
  const families = value.families.length
  const { prices, maps } = value
  return (
    typeof value.season === 'number' &&
    typeof value.exportedAt === 'string' &&
    isSeasons(value.seasons, value.season) &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    value.evidence.every(isEvidence) &&
    isObject(value.flex) &&
    isObject(prices) &&
    isNumbers(prices.refinement, attrMax(ATTR_REFINEMENT) + 1) &&
    isObject(prices.paragon) &&
    Object.values(prices.paragon).every((list) => isNumbers(list, attrMax(ATTR_PARAGON) + 1)) &&
    isNumbers(value.order) &&
    isPlacementData(value.placement) &&
    isModel(value.model) &&
    Array.isArray(maps) &&
    maps.length > 0 &&
    maps.every((m) => isMap(m, families)) &&
    new Set(maps.map((m: SlMap) => m.key)).size === maps.length &&
    Array.isArray(value.everyMap) &&
    value.everyMap.every((t) => isTeam(t, families) && isIndex(t.home, maps.length)) &&
    // A team outside every group falls back on the last list.
    Array.isArray(value.fallback) &&
    value.fallback.length === families + 1 &&
    value.fallback.every((list) => isNumbers(list))
  )
}

export async function decodeSlData(bytes: Uint8Array<ArrayBuffer>): Promise<SlData> {
  const stream = new Blob([await decrypt(bytes)])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  const data: unknown = JSON.parse(await new Response(stream).text())
  if (!isSlData(data)) throw new Error('The PvP data is not in the expected format')
  return data
}

// Only a load that worked is kept, so a failed one can be tried again.
let loaded: SlData | null = null

export async function loadSlData(): Promise<SlData> {
  if (loaded) return loaded
  const response = await fetch(pvpFileUrl)
  if (!response.ok) throw new Error(`The PvP data answered ${response.status}`)
  loaded = await decodeSlData(new Uint8Array(await response.arrayBuffer()))
  return loaded
}
