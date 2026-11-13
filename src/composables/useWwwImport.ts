/* Who Would Win?'s screenshot import: file intake of the Supreme League's
 * knockout matchup list, the review's corrections beside each reading, and the
 * games they make (lib/pvp/www/wwwImport). The import engine
 * (useImportEngine) decodes and reads the screenshots. Module-level state like
 * useRosterImport: the shots belong to one opening of the modal, and closing it
 * (clearImport) drops them and releases the engine. */

import { computed, reactive, ref, watch, type ComputedRef } from 'vue'

import {
  imageToDataUrl,
  type ImportEngine,
  type ShotError,
  type ShotSession,
  type ShotStatus,
} from '@/composables/useImportEngine'
import {
  markShot,
  newShotFields,
  useImportShotList,
  type ImportShotList,
  type ShotRef,
} from '@/composables/useImportShotList'
import { frameFamily } from '@/lib/import/card/frames'
import { isMatchupReading } from '@/lib/import/kinds'
import type { CellOverride, ReviewedCard } from '@/lib/import/review'
import { FOOT, MATCHUP_MAX_WIDTH } from '@/lib/import/screens/matchup/layout'
import type { BarColour, MatchupReading } from '@/lib/import/screens/matchup/types'
import { buildWwwImportPlan, cardKey, teamKey, type WwwImportPlan } from '@/lib/pvp/www/wwwImport'

export interface WwwImportShot {
  id: string
  kind: 'matchup'
  name: string
  size: number
  // Object URL of the file, for the card thumbnail.
  thumb: string
  // Object URL of the screenshot with each team box outlined and numbered by
  // its game, once read, and the game numbers it was drawn with.
  marked: string | null
  markedFor: string | null
  status: ShotStatus
  error: ShotError | null
  reading: MatchupReading | null
  // By card key.
  overrides: Record<string, CellOverride>
  // By team key: the artifact picked in review, null for none.
  artifacts: Record<string, number | null>
  // Data URLs of each card read, by card key, and of each artifact badge, by
  // team key.
  cards: Record<string, string>
  badges: Record<string, string>
}

const shots = ref<WwwImportShot[]>([])
let nextId = 1
const COLOURS: readonly BarColour[] = ['blue', 'red']

const findShot = (id: string): WwwImportShot | undefined => shots.value.find((s) => s.id === id)

/* The screenshot as the review numbers it: each team box outlined down to its
 * foot, and each panel labelled with the game it fills. */
const markPanels = async (
  shot: WwwImportShot,
  reading: MatchupReading,
  numbers: readonly number[],
): Promise<void> => {
  const drawn = numbers.join()
  const blob = await markShot(shot.thumb, MATCHUP_MAX_WIDTH, { fine: 400, text: 9 }, (pen) => {
    reading.panels.forEach((panel, p) => {
      for (const colour of COLOURS) {
        const { bar, cards } = panel[colour]
        pen.outline({ x: bar.x, y: bar.y, w: bar.w, h: FOOT.to * bar.w }, cards !== null)
      }
      pen.label(String(numbers[p]), panel.blue.bar, panel.blue.cards !== null)
    })
  })
  // Removed, renumbered, or the import closed, while it was drawn.
  if (!blob || findShot(shot.id) !== shot || shot.markedFor !== drawn) return
  if (shot.marked) URL.revokeObjectURL(shot.marked)
  shot.marked = URL.createObjectURL(blob)
}

const applyReading = (shot: WwwImportShot, reading: MatchupReading): void => {
  shot.reading = reading
  reading.panels.forEach((panel, p) => {
    for (const colour of COLOURS) {
      const team = panel[colour]
      shot.badges[teamKey(p, colour)] = imageToDataUrl(team.artifact.card)
      team.cards?.forEach((cell, slot) => {
        if (cell) shot.cards[cardKey(p, colour, slot)] = imageToDataUrl(cell.card)
      })
    }
  })
}

const session: ShotSession = {
  kinds: ['matchup'],
  shots: () => shots.value,
  apply: (id, reading) => {
    const shot = findShot(id)
    // Its shots are matchup lists, whose reader gives a matchup reading.
    if (shot && isMatchupReading(reading)) applyReading(shot, reading)
  },
}

export function useWwwImport(): Omit<ImportShotList, 'engine'> & {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  learnedCount: ComputedRef<number>
  plan: ComputedRef<WwwImportPlan>
  progress: ImportEngine['progress']
  setHero: (cards: readonly ReviewedCard[], characterId: number | null) => void
  setArtifact: (teams: readonly ShotRef[], artifactId: number | null) => void
  confirmAll: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  const { engine, ...list } = useImportShotList(
    shots,
    session,
    'matchup',
    (file) =>
      reactive({
        id: `matchup-${nextId++}`,
        kind: 'matchup',
        ...newShotFields(file),
        markedFor: null,
        artifacts: {},
        badges: {},
      }) as WwwImportShot,
  )
  const { setLevel } = list

  /* Take the cards for a hero, or for none. The cards given are one card seen
   * again, and the correction teaches from those a paragon frame placed
   * surely, whatever its level (a card below S+ never teaches, its face cut
   * from a guessed box; the reader keeps a paragon card's level, so its frame
   * reads again from it). */
  const setHero = (cards: readonly ReviewedCard[], characterId: number | null): void => {
    const found = cards.filter(({ shotId }) => findShot(shotId))
    for (const { shotId, key } of found) {
      const shot = findShot(shotId)!
      shot.overrides[key] = { ...shot.overrides[key], characterId }
    }
    engine.learnCorrection(
      found
        .map(({ cell }) => cell)
        .filter((cell) => {
          const frame = frameFamily(cell.paragon)
          return frame.family === 'paragon' && frame.sure
        }),
      characterId,
    )
  }

  // An artifact picked for a team is written to each of its readings.
  const setArtifact = (teams: readonly ShotRef[], artifactId: number | null): void => {
    for (const team of teams) {
      const shot = findShot(team.shotId)
      if (shot) shot.artifacts[team.key] = artifactId
    }
  }

  const plan = computed(() =>
    buildWwwImportPlan(
      shots.value.flatMap((s) =>
        s.reading
          ? [{ id: s.id, reading: s.reading, overrides: s.overrides, artifacts: s.artifacts }]
          : [],
      ),
    ),
  )

  // A screenshot's panels can move to other games after it is read, as
  // screenshots are added or removed or a correction links two, so its
  // outlines are drawn again with the new numbers.
  watch(
    () => plan.value.numbers,
    (numbers) => {
      for (const shot of shots.value) {
        const games = numbers[shot.id]
        if (!shot.reading || !games?.length || shot.markedFor === games.join()) continue
        shot.markedFor = games.join()
        void markPanels(shot, shot.reading, games).catch(() => {
          // The plain screenshot still shows in the lightbox.
        })
      }
    },
  )

  // Each doubtful part is confirmed as read, the hero on the readings that
  // name it, being their own top candidate, so no face is taught.
  const confirmAll = (): void => {
    for (const slot of plan.value.confirmable) {
      for (const part of slot.doubtful) {
        if (part === 'hero') {
          setHero(
            slot.cards.filter((c) => c.state !== 'none'),
            slot.characterId,
          )
        } else {
          setLevel(slot.cards, part, slot[part])
        }
      }
    }
  }

  return {
    shots,
    referenceStatus: engine.referenceStatus,
    learnedCount: engine.learnedCount,
    plan,
    progress: engine.progress,
    ...list,
    setHero,
    setArtifact,
    confirmAll,
    forgetLearned: engine.forgetLearned,
    ensureReferences: engine.ensureReferences,
  }
}
