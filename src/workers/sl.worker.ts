/* Supreme League worker: reads the data file once and answers the generator,
 * the boards' formations, the swaps tried on them, Generate and Placement tips
 * on the Arena and Teams and Who Would Win?, so neither the search, the
 * placing nor a prediction holds up the page. A press's fit checks and its
 * set's boards go to helpers (slHelpers.ts), started by the visit's first
 * press that has a board without records or needs fit checks. A press takes
 * the points the page kept from earlier visits (storedFits.ts) and answers
 * with those it measured. */

import { TOP_LEVELS, type AttrRecord } from '@/lib/characters/attributes'
import type { MapLayout } from '@/lib/maps'
import type { PlacementExplanation } from '@/lib/placement/explain'
import { loadSlData } from '@/lib/pvp/data/codec'
import { withheldHeroes } from '@/lib/pvp/data/sides'
import type { SlData, SlUnit } from '@/lib/pvp/data/types'
import { chooseSlSetAsync } from '@/lib/pvp/generator/chooser'
import { fitPoints, slFit, type SlFitRequest, type SlFitStore } from '@/lib/pvp/generator/fit'
import {
  boardDraws,
  engineFormation,
  marksCount,
  shownFormation,
  sideExplanation,
  type BoardDraw,
  type BoardFormation,
} from '@/lib/pvp/generator/formation'
import { slPicks } from '@/lib/pvp/generator/picks'
import { layoutBoards, type SlBoard } from '@/lib/pvp/generator/setType'
import type { StoredFits, StoredPoints } from '@/lib/pvp/generator/storedFits'
import { previewSwap, type SwapPreview, type SwapRequest } from '@/lib/pvp/generator/swapPreview'
import { slTeamData } from '@/lib/pvp/generator/team'
import type { SlChoice, SlChoiceTeam, SlPick } from '@/lib/pvp/generator/types'
import { readSlFile } from '@/lib/pvp/model/reader'
import { wwwPanel, type Pair, type WwwPanel, type WwwTeam } from '@/lib/pvp/www/panel'
import { artifactSurvives } from '@/lib/seasonal'
import { loadCharacters } from '@/utils/dataLoader'
import { startSlHelpers, type SlHelpers } from './slHelpers'

// `fits`: the points the page kept, with the visit's first press.
export type SlRequest =
  | { type: 'generate'; id: number; picks: SlPick[]; boards: SlBoard[]; fits: StoredFits | null }
  // A roster's levels, or null for every hero at the top levels.
  | {
      type: 'fill'
      id: number
      levels: Record<string, AttrRecord> | null
      layouts: MapLayout[]
      fits: StoredFits | null
    }
  | { type: 'place'; id: number; set: SlChoice; boards: SlBoard[] }
  // A side of a board as it stands, its units on their tiles.
  | {
      type: 'explain'
      id: number
      layout: MapLayout
      units: SlUnit[]
      artifact: number | null
    }
  | { type: 'placeEngine'; id: number; team: SlChoiceTeam; board: SlBoard }
  | { type: 'swap'; id: number; swap: SwapRequest }
  | { type: 'predict'; id: number; teams: Pair<WwwTeam> }

export type SlResponse =
  | { type: 'ready' }
  | { type: 'failed' }
  // `gained`: the points the press measured, null where nothing is kept.
  | { type: 'generated'; id: number; set: SlChoice | null; gained: StoredFits | null }
  // The set as a saved team, each board in the formation the generator page
  // draws first; null when no set can be made.
  | { type: 'filled'; id: number; team: string | null; gained: StoredFits | null }
  | { type: 'placed'; id: number; boards: BoardDraw[] }
  | { type: 'explained'; id: number; why: PlacementExplanation | null }
  | { type: 'placedEngine'; id: number; formation: BoardFormation }
  | { type: 'swapped'; id: number; preview: SwapPreview }
  | { type: 'predicted'; id: number; panel: WwwPanel }
  | { type: 'error'; id: number }

// The app compiles under the DOM lib, where `self` is a Window and its
// postMessage wants a target origin.
const scope = self as unknown as {
  postMessage(message: SlResponse): void
  addEventListener(type: 'message', listener: (event: MessageEvent<SlRequest>) => void): void
}

const heroes = loadCharacters().filter((c) => !c.placeholder)
const factions = new Map(heroes.map((c) => [c.id, c.faction]))
const withheld = withheldHeroes(heroes)

const engine = loadSlData().then((data) => ({
  data,
  reader: readSlFile(data),
  fit: slFit(data),
  counts: (id: number): boolean => artifactSurvives(data.season, id),
}))
type Engine = Awaited<typeof engine>

engine.then(
  () => scope.postMessage({ type: 'ready' }),
  () => scope.postMessage({ type: 'failed' }),
)

// The worker's file name, whose hash changes with the code and the data file;
// the development server's has none, so nothing is kept there.
const build = import.meta.env.DEV ? null : (self.location.pathname.split('/').at(-1) ?? null)

// Undefined until a press first needs them; null where the worker works
// alone, on a device with too few cores or once a helper fails.
let helpers: SlHelpers | null | undefined
const startHelpers = (): void => {
  if (helpers === undefined) helpers = startSlHelpers()
}

async function aside<T>(work: (pool: SlHelpers) => Promise<T>, alone: () => T): Promise<T> {
  if (helpers) {
    try {
      return await work(helpers)
    } catch {
      helpers = null
    }
  }
  return alone()
}

const fitsFor =
  (data: SlData, fit: SlFitStore, gained: StoredPoints) =>
  async (requests: SlFitRequest[]): Promise<void> => {
    const jobs = fit.jobs(requests)
    if (!jobs.length) return
    startHelpers()
    const found = await aside(
      (pool) => pool.fit(jobs),
      () => jobs.map((job) => fitPoints(data, job)),
    )
    jobs.forEach((job, index) => {
      for (const [map, lineups] of Object.entries(fit.record(job, found[index]!)))
        Object.assign((gained[map] ??= {}), lineups)
    })
  }

// Chooses the set with the points the page kept, when they come from this
// build, and gives back the points measured for it.
async function press(
  { data, reader, fit, counts }: Engine,
  picks: readonly SlPick[],
  boards: readonly SlBoard[],
  fits: StoredFits | null,
): Promise<{ set: SlChoice | null; gained: StoredFits | null }> {
  if (build !== null && fits?.build === build) fit.seed(fits.maps)
  if (boards.some((board) => board.source === null)) startHelpers()
  const gained: StoredPoints = {}
  const set = await chooseSlSetAsync(
    data,
    reader,
    picks,
    counts,
    boards,
    fit,
    fitsFor(data, fit, gained),
  )
  return { set, gained: build === null ? null : { build, maps: gained } }
}

const draws = (data: SlData, set: SlChoice, boards: readonly SlBoard[]): Promise<BoardDraw[]> => {
  const marks = marksCount(boards)
  return aside(
    (pool) =>
      pool.draw(set.teams.map((choice, index) => ({ choice, board: boards[index]!, marks }))),
    () => boardDraws(data, set, boards),
  )
}

scope.addEventListener('message', async (event) => {
  const msg = event.data
  try {
    const loaded = await engine
    const { data, reader, counts } = loaded
    if (msg.type === 'generate') {
      const { set, gained } = await press(loaded, msg.picks, msg.boards, msg.fits)
      scope.postMessage({ type: 'generated', id: msg.id, set, gained })
    } else if (msg.type === 'fill') {
      const levels = msg.levels ?? Object.fromEntries(heroes.map((c) => [c.id, TOP_LEVELS]))
      const picks = slPicks(levels, (id) => factions.get(id), withheld)
      const boards = layoutBoards(data, msg.layouts)
      const { set, gained } = await press(loaded, picks, boards, msg.fits)
      const formations = set
        ? (await draws(data, set, boards)).map((draw) => shownFormation(draw, false))
        : []
      const team = set && slTeamData(data, set, picks, boards, formations)
      scope.postMessage({ type: 'filled', id: msg.id, team, gained })
    } else if (msg.type === 'explain') {
      const why = sideExplanation(data, msg.layout, msg.units, msg.artifact)
      scope.postMessage({ type: 'explained', id: msg.id, why })
    } else if (msg.type === 'place') {
      const boards = await draws(data, msg.set, msg.boards)
      scope.postMessage({ type: 'placed', id: msg.id, boards })
    } else if (msg.type === 'placeEngine') {
      const formation = engineFormation(data, msg.team, msg.board)
      scope.postMessage({ type: 'placedEngine', id: msg.id, formation })
    } else if (msg.type === 'swap') {
      const preview = previewSwap(data, msg.swap)
      scope.postMessage({ type: 'swapped', id: msg.id, preview })
    } else {
      const panel = wwwPanel(data, reader, msg.teams, counts)
      scope.postMessage({ type: 'predicted', id: msg.id, panel })
    }
  } catch {
    // A file whose parts do not line up passes the shape check and fails here.
    scope.postMessage({ type: 'error', id: msg.id })
  }
})
