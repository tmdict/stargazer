/* Reads the Supreme League data file (pvp/sl.bin in the data pack).
 * The file is the JSON compressed with raw deflate, then encrypted with AES-GCM,
 * so it is noise in the browser's network panel. The key comes from pvp/sl.key,
 * new with each export, and the repository holds neither. It deters a casual
 * look, nothing more: Vite writes sl.key into this script, which every visitor
 * downloads. The decoded data is held here and handed to the page as a plain
 * object, never put in a store or on window. */

import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { MAPS } from '@/lib/maps'
import { TEAM_MODES } from '@/lib/teams/modes'
import slFileUrl from '@/pack/pvp/sl.bin?url'
import slKey from '@/pack/pvp/sl.key?raw'
import type { SlData, SlModel, SlTeam } from './types'

// The writer combines sl.key with the same text, so what the script stores is
// not itself the key.
const KEY_MIX = 'stargazer-sl'

async function decrypt(file: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  const material = new TextEncoder().encode(`${slKey.trim()}${KEY_MIX}`)
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

const isFamily = (value: unknown): boolean =>
  isObject(value) &&
  isObject(value.name) &&
  isNumbers(value.core) &&
  Array.isArray(value.swaps) &&
  value.swaps.every((team: unknown) => isNumbers(team, 5)) &&
  Array.isArray(value.perMap) &&
  value.perMap.every((record: unknown) => isNumbers(record, 3))

const isOwnArtifacts = (value: unknown, artifacts: 'artifacts' | 'like'): boolean =>
  artifacts === 'like'
    ? isNumbers(value)
    : Array.isArray(value) && value.every((row: unknown) => isNumbers(row, 2))

const isPick = (value: unknown, placements: number): boolean =>
  Array.isArray(value) &&
  value.length === 2 &&
  (value[0] === null || Number.isInteger(value[0])) &&
  Number.isInteger(value[1]) &&
  value[1] >= 0 &&
  value[1] < placements

const isSeason = (value: unknown, artifacts: 'artifacts' | 'like'): boolean =>
  isObject(value) &&
  isObject(value.sample) &&
  isNumbers([value.sample.matches, value.sample.games, value.sample.players]) &&
  Array.isArray(value.families) &&
  value.families.every(isFamily) &&
  Array.isArray(value.teams) &&
  value.teams.every(
    (t: unknown) =>
      isObject(t) &&
      isNumbers(t.heroes, 5) &&
      typeof t.decided === 'number' &&
      isOwnArtifacts(t[artifacts], artifacts) &&
      Array.isArray(t.placements) &&
      (t.pick === undefined ||
        (Array.isArray(t.pick) &&
          t.pick.every((pick: unknown) => isPick(pick, (t.placements as unknown[]).length)))),
  )

const isNumberRecord = (value: unknown): boolean =>
  isObject(value) && Object.values(value).every((n) => typeof n === 'number')

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

// The generator locks a hero with no row as one the file cannot rate yet, so
// the rows must be exactly the heroes of the season's decided games.
const ratesDecidedHeroes = (model: SlModel, teams: readonly SlTeam[]): boolean => {
  const played = new Set(teams.filter((t) => t.decided > 0).flatMap((t) => t.heroes))
  const rated = Object.keys(model.heroes)
  return rated.length === played.size && rated.every((id) => played.has(Number(id)))
}

const isListEntry = (value: unknown): boolean =>
  Number.isInteger(value) || (isObject(value) && typeof value.list === 'string')

const isPlacementData = (value: unknown): boolean =>
  isObject(value) &&
  isObject(value.lists) &&
  Object.values(value.lists).every((list) => Array.isArray(list) && list.every(isListEntry)) &&
  isObject(value.leans) &&
  isNumbers(value.leans.front) &&
  isNumbers(value.leans.back) &&
  Array.isArray(value.formationRules) &&
  value.formationRules.every(
    (rule: unknown) =>
      isObject(rule) &&
      isNumbers(rule.heroes) &&
      typeof rule.relation === 'string' &&
      (rule.holds === 'always' || rule.holds === 'usually'),
  ) &&
  isNumberRecord(value.weights) &&
  isObject(value.pickRates) &&
  Object.values(value.pickRates).every(isNumberRecord)

/* The shape the reader, the generator and the pages rely on: a file of another
 * shape (one written for other code, or a page the host served in its place)
 * is refused whole. The levels' prices must cover every level Stargazer
 * offers, and every map it names must be one of Stargazer's. */
function isSlData(value: unknown): value is SlData {
  if (!isObject(value) || !isSeason(value, 'artifacts')) return false
  const { prices, before } = value
  return (
    typeof value.season === 'number' &&
    typeof value.exportedAt === 'string' &&
    Array.isArray(value.maps) &&
    value.maps.length === TEAM_MODES['5v5'].boardCount &&
    value.maps.every((key) => typeof key === 'string' && Object.hasOwn(MAPS, key)) &&
    Array.isArray(value.evidence) &&
    value.evidence.length > 0 &&
    isObject(value.flex) &&
    isObject(prices) &&
    isNumbers(prices.refinement, attrMax(ATTR_REFINEMENT) + 1) &&
    isObject(prices.paragon) &&
    Object.values(prices.paragon).every((list) => isNumbers(list, attrMax(ATTR_PARAGON) + 1)) &&
    isNumbers(value.order) &&
    isPlacementData(value.placement) &&
    isModel(value.model) &&
    ratesDecidedHeroes(value.model as SlModel, value.teams as SlTeam[]) &&
    // A team outside every group falls back on the last list.
    Array.isArray(value.fallback) &&
    value.fallback.length === (value.families as unknown[]).length + 1 &&
    value.fallback.every((list) => isNumbers(list)) &&
    (before === undefined ||
      (isSeason(before, 'like') &&
        typeof (before as Record<string, unknown>).season === 'number' &&
        typeof value.beforeUnder === 'number'))
  )
}

export async function decodeSlData(bytes: Uint8Array<ArrayBuffer>): Promise<SlData> {
  const stream = new Blob([await decrypt(bytes)])
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
