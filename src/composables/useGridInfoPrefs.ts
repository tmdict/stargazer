/* Device-level Grid Info preferences: one master switch plus granular children,
 * shared by the Arena, Teams, and ShareView pages. Stored as the `gridInfo`
 * slice of the generic `stargazer.prefs` key so future device prefs can join
 * the key; writes read-modify-write the whole object and preserve sibling
 * slices they don't own.
 *
 * The first call seeds storage synchronously, so pages must call this
 * composable before their persistence reads (the arena autosave load, the
 * Teams display byte): the seed runs gridInfoMigration's one-time legacy byte
 * remap those reads depend on. The reactive prefs themselves render as the
 * defaults and adopt the stored values in onMounted: '/' and /share are
 * SSG-prerendered with the defaults, so a setup-time adoption would
 * hydration-mismatch for any user whose stored prefs differ.
 *
 * Enabling a child auto-enables what it needs to take effect (master; Paragon
 * also Hero card, Coordinates also Tile IDs); disabling never cascades, so a
 * re-enabled parent restores the children it had.
 */

import { getCurrentInstance, onMounted, reactive } from 'vue'

import { remapLegacyDisplayBytes } from '@/utils/gridInfoMigration'
import { readStorage, writeStorage } from '@/utils/storage'

const PREFS_KEY = 'stargazer.prefs'

export interface GridInfoPrefs {
  master: boolean
  tileIds: boolean
  hover: boolean
  heroCard: boolean
  paragon: boolean
  refinement: boolean
  targeting: boolean
  coordinates: boolean
}

export type GridInfoKey = keyof GridInfoPrefs

/* Effective per-surface visibility: the prefs with the master (and structural
 * parents) ANDed in. Pages derive it and thread it through the grid chain. */
export interface GridInfoView {
  tileIds: boolean
  coordinates: boolean
  hover: boolean
  heroCard: boolean
  paragon: boolean
  refinement: boolean
  targeting: boolean
}

const DEFAULTS: GridInfoPrefs = {
  master: false,
  tileIds: true,
  hover: true,
  heroCard: false,
  paragon: false,
  refinement: false,
  targeting: false,
  coordinates: false,
}

const PREF_KEYS = Object.keys(DEFAULTS) as GridInfoKey[]

/* Structural parents beyond the master, encoded once: the enable cascade, the
 * effective derivation, and the checklist's indentation/dimming all read this
 * map, so a future nested child cannot ship with the three out of sync. */
export const GRID_INFO_PARENTS: Partial<Record<GridInfoKey, GridInfoKey[]>> = {
  paragon: ['heroCard'],
  refinement: ['heroCard'],
  coordinates: ['tileIds'],
}

export function deriveGridInfoView(prefs: GridInfoPrefs): GridInfoView {
  const effective = (key: Exclude<GridInfoKey, 'master'>): boolean =>
    prefs.master && prefs[key] && (GRID_INFO_PARENTS[key] ?? []).every((parent) => prefs[parent])
  return {
    tileIds: effective('tileIds'),
    coordinates: effective('coordinates'),
    hover: effective('hover'),
    heroCard: effective('heroCard'),
    paragon: effective('paragon'),
    refinement: effective('refinement'),
    targeting: effective('targeting'),
  }
}

// Map-editor painting suppresses every surface without touching the pref.
export const GRID_INFO_NONE: GridInfoView = Object.freeze({
  tileIds: false,
  coordinates: false,
  hover: false,
  heroCard: false,
  paragon: false,
  refinement: false,
  targeting: false,
})

// The stored slice merged over the defaults (booleans only, so a wrong-typed
// value can't leak into the pref state), or null when the object is unparsable.
const sliceFrom = (raw: string): GridInfoPrefs | null => {
  try {
    const parsed: unknown = JSON.parse(raw)
    const slice =
      parsed && typeof parsed === 'object' ? (parsed as { gridInfo?: unknown }).gridInfo : undefined
    const merged = { ...DEFAULTS }
    if (slice && typeof slice === 'object') {
      for (const key of PREF_KEYS) {
        const value = (slice as Record<string, unknown>)[key]
        if (typeof value === 'boolean') merged[key] = value
      }
    }
    return merged
  } catch {
    return null
  }
}

const seedStorage = (): boolean => writeStorage(PREFS_KEY, JSON.stringify({ gridInfo: DEFAULTS }))

/* Read the stored slice, seeding on first run. The key's absence doubles as
 * gridInfoMigration's not-yet-migrated marker: the marker write goes FIRST,
 * and the remap runs only if it landed, so a failed write leaves the legacy
 * bytes intact for a clean retry while a landed one guarantees the remap
 * can't repeat. A corrupt object reseeds without remapping (the marker
 * existed, so the bytes are already current-layout). */
const initStorage = (): GridInfoPrefs => {
  const raw = readStorage(PREFS_KEY)
  if (raw === null) {
    if (seedStorage()) {
      remapLegacyDisplayBytes() // TEMPORARY: delete with gridInfoMigration.ts
    }
    return { ...DEFAULTS }
  }
  const slice = sliceFrom(raw)
  if (slice === null) {
    seedStorage()
    return { ...DEFAULTS }
  }
  return slice
}

const persist = (prefs: GridInfoPrefs): void => {
  let stored: Record<string, unknown> = {}
  const raw = readStorage(PREFS_KEY)
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        stored = parsed as Record<string, unknown>
      }
    } catch {
      // Corrupt object: rebuilt around this slice alone.
    }
  }
  stored.gridInfo = { ...prefs }
  writeStorage(PREFS_KEY, JSON.stringify(stored))
}

let prefs: GridInfoPrefs | null = null
let storedAtInit: GridInfoPrefs | null = null
let adopted = false

export function useGridInfoPrefs(): {
  prefs: GridInfoPrefs
  setPref: (key: GridInfoKey, value: boolean) => void
} {
  if (!prefs) {
    prefs = reactive({ ...DEFAULTS })
    storedAtInit = initStorage()
  }
  const state = prefs

  // Registered by every consumer while unadopted; the first hook to fire wins.
  if (!adopted && getCurrentInstance()) {
    onMounted(() => {
      if (adopted) return
      adopted = true
      Object.assign(state, storedAtInit)
    })
  }

  const setPref = (key: GridInfoKey, value: boolean): void => {
    state[key] = value
    if (value && key !== 'master') {
      state.master = true
      const enableParents = (child: GridInfoKey): void => {
        for (const parent of GRID_INFO_PARENTS[child] ?? []) {
          state[parent] = true
          enableParents(parent)
        }
      }
      enableParents(key)
    }
    persist(state)
  }

  return { prefs: state, setPref }
}
