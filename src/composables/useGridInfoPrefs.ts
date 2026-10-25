/* Device-level Grid Info preferences: one master switch plus granular children,
 * shared by the Arena, Teams, and ShareView pages. Stored as the `gridInfo`
 * field of `stargazer.prefs` (utils/prefs.ts).
 *
 * The first call seeds storage synchronously. The reactive prefs themselves
 * render as the defaults and adopt the stored values in onMounted: '/' and
 * /share are SSG-prerendered with the defaults, so a setup-time adoption
 * would hydration-mismatch for any user whose stored prefs differ.
 *
 * Enabling a child auto-enables what it needs to take effect (master; Upgrades
 * also Hero card, Coordinates also Tile IDs); disabling never cascades, so a
 * re-enabled parent restores the children it had.
 */

import { getCurrentInstance, onMounted, reactive } from 'vue'

import { readPrefs, writePref } from '@/utils/prefs'

export interface GridInfoPrefs {
  master: boolean
  tileIds: boolean
  hover: boolean
  heroCard: boolean
  upgrades: boolean
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
  upgrades: boolean
  targeting: boolean
}

const DEFAULTS: GridInfoPrefs = {
  master: false,
  tileIds: true,
  hover: true,
  heroCard: false,
  upgrades: false,
  targeting: false,
  coordinates: false,
}

const PREF_KEYS = Object.keys(DEFAULTS) as GridInfoKey[]

/* Structural parents beyond the master, encoded once: the enable cascade, the
 * effective derivation, and the checklist's indentation/dimming all read this
 * map, so a future nested child cannot ship with the three out of sync. */
export const GRID_INFO_PARENTS: Partial<Record<GridInfoKey, GridInfoKey[]>> = {
  upgrades: ['heroCard'],
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
    upgrades: effective('upgrades'),
    targeting: effective('targeting'),
  }
}

// Map-editor painting suppresses every surface without touching the pref.
export const GRID_INFO_NONE: GridInfoView = Object.freeze({
  tileIds: false,
  coordinates: false,
  hover: false,
  heroCard: false,
  upgrades: false,
  targeting: false,
})

// The stored slice merged over the defaults (booleans only, so a wrong-typed
// value can't leak into the pref state).
const sliceFrom = (slice: unknown): GridInfoPrefs => {
  const merged = { ...DEFAULTS }
  if (slice && typeof slice === 'object') {
    for (const key of PREF_KEYS) {
      const value = (slice as Record<string, unknown>)[key]
      if (typeof value === 'boolean') merged[key] = value
    }
  }
  return merged
}

// Read the stored slice, seeding on first run.
const initStorage = (): GridInfoPrefs => {
  const stored = readPrefs()
  if (stored === null) {
    writePref('gridInfo', DEFAULTS)
    return { ...DEFAULTS }
  }
  return sliceFrom(stored.gridInfo)
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
    writePref('gridInfo', { ...state })
  }

  return { prefs: state, setPref }
}
