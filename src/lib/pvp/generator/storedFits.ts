/* The points fit checks find, kept in the browser between visits under
 * `stargazer.fits` (docs/architecture/PLACEMENT.md has the shape). The worker
 * measures them and the page keeps them, since a worker cannot reach
 * localStorage. `build` is the worker's file name, whose hash changes with the
 * code and the data file the points came from, so a value from another build
 * is never used. */

// Points per map key, then per lineup (hero ids joined by commas), the maps in
// the order they last gained points, the oldest first.
export type StoredPoints = Record<string, Record<string, number>>

export interface StoredFits {
  build: string
  maps: StoredPoints
}

export const FITS_KEY = 'stargazer.fits'
const FITS_CAP = 2000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The stored value, or null when there is none or it is not the shape the app
// writes.
export function parseStoredFits(text: string | null): StoredFits | null {
  if (text === null) return null
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(value) || typeof value.build !== 'string' || !isRecord(value.maps)) return null
  for (const lineups of Object.values(value.maps)) {
    if (!isRecord(lineups)) return null
    for (const points of Object.values(lineups))
      if (typeof points !== 'number' || !Number.isFinite(points)) return null
  }
  return { build: value.build, maps: value.maps as StoredPoints }
}

// The stored points with those gained added, each map that gained some moved
// last. Past the cap, the maps that gained points longest ago go whole, since
// the order is kept per map; the one that gained last always stays.
export function mergeFits(stored: StoredPoints, gained: StoredPoints): StoredPoints {
  const maps: [string, Record<string, number>][] = [
    ...Object.entries(stored).filter(([map]) => !(map in gained)),
    ...Object.entries(gained).map(([map, lineups]): [string, Record<string, number>] => [
      map,
      { ...stored[map], ...lineups },
    ]),
  ]
  let size = maps.reduce((n, [, lineups]) => n + Object.keys(lineups).length, 0)
  let first = 0
  while (size > FITS_CAP && first < maps.length - 1) size -= Object.keys(maps[first++]![1]).length
  return Object.fromEntries(maps.slice(first))
}
