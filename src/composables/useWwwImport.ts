/* Who Would Win?'s screenshot import: file intake of the Supreme League's
 * knockout matchup list, the review's corrections beside each reading, and the
 * games they make (lib/pvp/sl/www/wwwImport). The import engine
 * (useImportEngine) decodes and reads the screenshots. Module-level state like
 * useRosterImport: the shots belong to one opening of the modal (clearImport),
 * and the modal holds the engine for the page visit, the shots dropped with it
 * when the page is left. */

import {
  computed,
  getCurrentScope,
  onScopeDispose,
  reactive,
  ref,
  watch,
  type ComputedRef,
} from 'vue'

import {
  imageToDataUrl,
  useImportEngine,
  type ImportEngine,
  type IntakeResult,
  type ShotError,
  type ShotSession,
  type ShotStatus,
} from '@/composables/useImportEngine'
import { frameFamily } from '@/lib/import/card/frames'
import { isMatchupReading } from '@/lib/import/kinds'
import type { CellOverride } from '@/lib/import/review'
import { FOOT, MATCHUP_MAX_WIDTH } from '@/lib/import/screens/matchup/layout'
import type { BarColour, MatchupReading } from '@/lib/import/screens/matchup/types'
import {
  buildWwwImportPlan,
  cardKey,
  teamKey,
  type WwwCard,
  type WwwImportPlan,
} from '@/lib/pvp/sl/www/wwwImport'

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

// A card, or a team's artifact, of a screenshot, as the review's edits name it.
export interface ShotRef {
  shotId: string
  key: string
}

const shots = ref<WwwImportShot[]>([])
let nextId = 1
// Shots belong to one opening of the modal; clearImport ends it, and an
// addFiles still sorting or decoding for that opening stops adding.
let opening = 0
// A team whose cards were read is outlined in yellow; one whose cards are out
// of view, in grey and dashed, so a game counted as cut off can be found.
const READ_COLOUR = '#ffd54a'
const SKIPPED_COLOUR = '#b8b8b8'
const COLOURS: readonly BarColour[] = ['blue', 'red']

const findShot = (id: string): WwwImportShot | undefined => shots.value.find((s) => s.id === id)

/* The screenshot as the review numbers it: each team box outlined down to its
 * foot, and each panel labelled with the game it fills. Boxes are in the
 * decoded image's pixels, which a wide capture was drawn down to. */
const markPanels = async (
  shot: WwwImportShot,
  reading: MatchupReading,
  numbers: readonly number[],
): Promise<void> => {
  const drawn = numbers.join()
  const image = new Image()
  image.src = shot.thumb
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(image, 0, 0)
  const scale = image.naturalWidth / Math.min(image.naturalWidth, MATCHUP_MAX_WIDTH)
  const unit = Math.max(2, Math.round(canvas.width / 400))
  ctx.font = `700 ${unit * 9}px sans-serif`
  ctx.textBaseline = 'top'
  reading.panels.forEach((panel, p) => {
    for (const colour of COLOURS) {
      const { bar, cards } = panel[colour]
      ctx.lineWidth = unit
      ctx.strokeStyle = cards ? READ_COLOUR : SKIPPED_COLOUR
      ctx.setLineDash(cards ? [] : [unit * 3, unit * 2])
      ctx.strokeRect(bar.x * scale, bar.y * scale, bar.w * scale, FOOT.to * bar.w * scale)
    }
    const { bar, cards } = panel.blue
    const label = String(numbers[p])
    const at = { x: bar.x * scale + unit, y: bar.y * scale + unit }
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    ctx.fillRect(at.x, at.y, ctx.measureText(label).width + unit * 2, unit * 11)
    ctx.fillStyle = cards ? READ_COLOUR : SKIPPED_COLOUR
    ctx.fillText(label, at.x + unit, at.y + unit)
  })
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
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

const dropUrls = (shot: WwwImportShot): void => {
  URL.revokeObjectURL(shot.thumb)
  if (shot.marked) URL.revokeObjectURL(shot.marked)
}

export function useWwwImport(): {
  shots: typeof shots
  referenceStatus: ImportEngine['referenceStatus']
  learnedCount: ComputedRef<number>
  plan: ComputedRef<WwwImportPlan>
  progress: ImportEngine['progress']
  addFiles: (files: File[]) => Promise<IntakeResult>
  removeShot: (id: string) => void
  clearImport: () => void
  setHero: (cards: readonly WwwCard[], characterId: number | null) => void
  setLevel: (cards: readonly ShotRef[], field: 'paragon' | 'refinement', level: number) => void
  setArtifact: (teams: readonly ShotRef[], artifactId: number | null) => void
  confirmAll: () => void
  forgetLearned: () => void
  ensureReferences: () => Promise<void>
} {
  const engine = useImportEngine(session)

  /* End an opening of the modal: drop every shot with its review edits and
   * waiting read, so the next opening starts fresh. The engine and the learned
   * faces stay for the page visit. */
  const clearImport = (): void => {
    opening++
    for (const shot of shots.value) {
      engine.dropShot(shot.id)
      dropUrls(shot)
    }
    shots.value = []
  }
  // Leaving the page unmounts the modal, and its shots go with the engine.
  if (getCurrentScope()) onScopeDispose(clearImport)

  // One the sorter finds to be another import's is refused and counted by
  // kind; one it cannot place is read as a matchup list.
  const addFiles = (files: File[]): Promise<IntakeResult> => {
    const mine = opening
    return engine.addFiles(files, {
      current: () => mine === opening,
      replay: () => true,
      place: (sorted) =>
        sorted && sorted !== 'matchup' ? { refused: sorted } : { kind: 'matchup' as const },
      add: (file) => {
        const shot = reactive({
          id: `matchup-${nextId++}`,
          kind: 'matchup',
          name: file.name,
          size: file.size,
          thumb: URL.createObjectURL(file),
          marked: null,
          markedFor: null,
          status: 'waiting',
          error: null,
          reading: null,
          overrides: {},
          artifacts: {},
          cards: {},
          badges: {},
        }) as WwwImportShot
        shots.value = [...shots.value, shot]
        return shot
      },
    })
  }

  const removeShot = (id: string): void => {
    const shot = findShot(id)
    if (shot) dropUrls(shot)
    engine.dropShot(id)
    shots.value = shots.value.filter((s) => s.id !== id)
  }

  /* Take the cards for a hero, or for none. A correction of a card the reader
   * was unsure of teaches its face, when a paragon frame placed it surely,
   * whatever its level (a card below S+ never teaches, its face cut from a
   * guessed box; the reader keeps a paragon card's level, so its frame reads
   * again from it); picking the reader's own top candidate, or no hero, takes
   * back what it was taught. The cards given are one card seen again, so the
   * first teaches and the others take back what each was taught on its own. */
  const setHero = (cards: readonly WwwCard[], characterId: number | null): void => {
    let first = true
    for (const { shotId, key, cell } of cards) {
      const shot = findShot(shotId)
      if (!shot) continue
      shot.overrides[key] = { ...shot.overrides[key], characterId }
      const frame = frameFamily(cell.paragon)
      if (cell.sure || frame.family !== 'paragon' || !frame.sure) continue
      const teach = first && characterId !== null && cell.candidates[0]?.characterId !== characterId
      engine.learnFace(teach ? characterId : null, cell.descriptor)
      first = false
    }
  }

  // A level set for a card is written to each of its readings.
  const setLevel = (
    cards: readonly ShotRef[],
    field: 'paragon' | 'refinement',
    level: number,
  ): void => {
    for (const card of cards) {
      const shot = findShot(card.shotId)
      if (shot) shot.overrides[card.key] = { ...shot.overrides[card.key], [field]: level }
    }
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
    addFiles,
    removeShot,
    clearImport,
    setHero,
    setLevel,
    setArtifact,
    confirmAll,
    forgetLearned: engine.forgetLearned,
    ensureReferences: engine.ensureReferences,
  }
}
