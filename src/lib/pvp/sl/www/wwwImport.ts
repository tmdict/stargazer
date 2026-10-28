/* Who Would Win?'s screenshot import plan: the panels of every matchup
 * screenshot put together into the match's games, each card's readings with
 * the reviewer's corrections beside them, what the review asks about and what
 * holds back Fill, and the five games Fill puts in. A player fields each hero
 * and each artifact once in a match, so a team's sure hero (or, beside a panel
 * whose cards are out of view, its sure artifact) seen in two screenshots
 * places them against each other. The plan is worked out again from the
 * readings and corrections on every change. */

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import type { HeroReading } from '@/lib/import/card/types'
import {
  cellState,
  doubtfulParts,
  PART_STATE,
  reviewedAttrs,
  reviewedCharacterId,
  type CellOverride,
  type CellState,
  type ReviewPart,
} from '@/lib/import/review'
import type { ArtifactReading } from '@/lib/import/screens/match/types'
import type { BarColour, MatchupPanel, MatchupReading } from '@/lib/import/screens/matchup/types'
import { WWW_GAMES, type WwwGame, type WwwTeamState } from './match'
import type { Pair, TeamSide } from './panel'

const COLOURS: readonly BarColour[] = ['blue', 'red']
// The left (blue) team is Team A.
const SIDE_OF: Record<BarColour, TeamSide> = { blue: 'a', red: 'b' }
const PARTS: readonly ReviewPart[] = ['hero', 'paragon', 'refinement']

/* A team box's key in its screenshot, and a card's: by panel, top to bottom,
 * and card, left to right. */
export const teamKey = (panel: number, colour: BarColour): string => `${panel}:${colour}`
export const cardKey = (panel: number, colour: BarColour, slot: number): string =>
  `${teamKey(panel, colour)}:${slot}`

export interface WwwShotInput {
  id: string
  reading: MatchupReading
  // By card key.
  overrides: Readonly<Record<string, CellOverride>>
  // By team key: the artifact picked in review, null for none.
  artifacts: Readonly<Record<string, number | null>>
}

// One screenshot's reading of a card, as reviewed.
export interface WwwCard {
  shotId: string
  key: string
  cell: HeroReading
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  doubtful: ReviewPart[]
  edited: boolean
}

// What a card or an artifact asks about: its screenshots read it differently,
// or its side fields it in two places. Both hold back Fill.
export type WwwIssue = 'differ' | 'twice'

// A card of a game: every screenshot's reading of it and what they settle on.
export interface WwwSlot {
  cards: WwwCard[]
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  doubtful: ReviewPart[]
  edited: boolean
  issues: WwwIssue[]
}

// One screenshot's reading of a team's artifact.
export interface WwwBadge {
  shotId: string
  key: string
  reading: ArtifactReading
  // Picked in review, else read surely (null for a badge with no artifact);
  // null too for a reading that is not sure, which stays empty (not
  // recognised) until one is picked.
  artifactId: number | null
  edited: boolean
}

export interface WwwTeamPlan {
  // Left to right.
  slots: WwwSlot[]
  badges: WwwBadge[]
  artifactId: number | null
  artifactEdited: boolean
  artifactIssues: WwwIssue[]
}

export interface WwwImportPlan {
  // By shot id, the game number of each of its panels, top to bottom.
  numbers: Record<string, number[]>
  // Five games, or more when the screenshots show more; null for a game whose
  // two teams' cards no screenshot shows.
  games: (Pair<WwwTeamPlan> | null)[]
  // The numbers of the five games that are null.
  missing: number[]
  // The screenshots do not fit one match: links that disagree, or more than
  // five games. A screenshot of another match, most likely.
  otherMatch: boolean
  // Cards and artifacts left to look at: a doubt, an issue, a card not recognised.
  toCheck: number
  // The cards the review confirms as read in one go: a doubt and no issue.
  confirmable: WwwSlot[]
  // What Fill puts in: five games, null for those not shown.
  fill: (WwwGame | null)[]
  blocked: boolean
}

const inView = (panel: MatchupPanel): boolean =>
  COLOURS.some((colour) => panel[colour].cards !== null)

const cardOf = (shot: WwwShotInput, key: string, cell: HeroReading): WwwCard => {
  const override = shot.overrides[key] ?? {}
  const attrs = reviewedAttrs(cell, override)
  return {
    shotId: shot.id,
    key,
    cell,
    characterId: reviewedCharacterId(cell, override),
    paragon: attrs[ATTR_PARAGON] ?? 0,
    refinement: attrs[ATTR_REFINEMENT] ?? 0,
    state: cellState(cell, override),
    doubtful: doubtfulParts(cell, override),
    edited: Object.keys(override).length > 0,
  }
}

const badgeOf = (shot: WwwShotInput, panel: number, colour: BarColour): WwwBadge => {
  const key = teamKey(panel, colour)
  const reading = shot.reading.panels[panel]![colour].artifact
  const picked = shot.artifacts[key]
  const read = reading.sure ? (reading.candidates[0]?.artifactId ?? null) : null
  return {
    shotId: shot.id,
    key,
    reading,
    artifactId: picked === undefined ? read : picked,
    edited: picked !== undefined,
  }
}

// What links a team across screenshots: its settled heroes, null while its
// cards are out of view, and its settled artifact.
interface TeamSign {
  heroes: Set<number> | null
  artifact: number | null
}

const signOf = (shot: WwwShotInput, panel: number): Record<BarColour, TeamSign> => {
  const sign = (colour: BarColour): TeamSign => {
    const cards = shot.reading.panels[panel]![colour].cards
    return {
      heroes:
        cards &&
        new Set(
          cards.flatMap((cell, slot) => {
            const card = cardOf(shot, cardKey(panel, colour, slot), cell)
            return card.characterId !== null && !card.doubtful.includes('hero')
              ? [card.characterId]
              : []
          }),
        ),
      artifact: badgeOf(shot, panel, colour).artifactId,
    }
  }
  return { blue: sign('blue'), red: sign('red') }
}

const sameGame = (x: Record<BarColour, TeamSign>, y: Record<BarColour, TeamSign>): boolean =>
  COLOURS.some((colour) => {
    const a = x[colour]
    const b = y[colour]
    if (a.heroes && b.heroes) return [...a.heroes].some((id) => b.heroes!.has(id))
    return a.artifact !== null && a.artifact === b.artifact
  })

/* Each screenshot's first game, from 0, and whether the screenshots fit one
 * match. Linked screenshots keep their places against each other; groups
 * linked to none follow one another, a group whose last game's cards are out
 * of view first, since the list goes on below it, and otherwise in the order
 * added. Where the games then pass five, each seam's groups overlap by the
 * excess. */
function placeShots(shots: readonly WwwShotInput[]): { starts: number[]; fits: boolean } {
  const signs = shots.map((shot) => shot.reading.panels.map((_, p) => signOf(shot, p)))
  // Shot j's first game less shot i's.
  const links: { i: number; j: number; shift: number }[] = []
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      signs[i]!.forEach((x, a) => {
        signs[j]!.forEach((y, b) => {
          if (sameGame(x, y)) links.push({ i, j, shift: a - b })
        })
      })
    }
  }

  const offset: (number | null)[] = shots.map(() => null)
  let fits = true
  const groups: { members: number[]; span: number; open: boolean }[] = []
  shots.forEach((shot, first) => {
    if (offset[first] !== null || !shot.reading.panels.length) return
    offset[first] = 0
    const members = [first]
    for (let k = 0; k < members.length; k++) {
      const s = members[k]!
      for (const { i, j, shift } of links) {
        if (i !== s && j !== s) continue
        const other = i === s ? j : i
        const at = offset[s]! + (i === s ? shift : -shift)
        if (offset[other] === null) {
          offset[other] = at
          members.push(other)
        } else if (offset[other] !== at) {
          fits = false
        }
      }
    }
    const least = Math.min(...members.map((s) => offset[s]!))
    for (const s of members) offset[s] = offset[s]! - least
    const span = Math.max(...members.map((s) => offset[s]! + shots[s]!.reading.panels.length))
    const last = members.flatMap((s) => {
      const panel = shots[s]!.reading.panels[span - 1 - offset[s]!]
      return panel ? [panel] : []
    })
    groups.push({ members, span, open: !last.some(inView) })
  })

  const ordered = [...groups].sort((a, b) => Number(b.open) - Number(a.open))
  let excess = Math.max(0, ordered.reduce((sum, g) => sum + g.span, 0) - WWW_GAMES)
  const starts = shots.map(() => 0)
  let end = 0
  ordered.forEach((group, k) => {
    const overlap = k ? Math.min(excess, group.span, ordered[k - 1]!.span) : 0
    excess -= overlap
    const start = end - overlap
    for (const s of group.members) starts[s] = start + offset[s]!
    end = Math.max(end, start + group.span)
  })
  return { starts, fits: fits && end <= WWW_GAMES }
}

/* A card's readings settled into one: for each part, the sure readings stand
 * over the unsure ones, and readings that still disagree are asked about. A
 * reading that recognised nothing says nothing while another names a hero. */
function slotOf(cards: WwwCard[]): WwwSlot {
  const edited = cards.some((c) => c.edited)
  const named = cards.filter((c) => c.state !== 'none')
  if (!named.length) {
    const { characterId, paragon, refinement } = cards[0]!
    return {
      cards,
      characterId,
      paragon,
      refinement,
      state: 'none',
      doubtful: [],
      edited,
      issues: [],
    }
  }
  const settle = (part: ReviewPart) => {
    const sure = named.filter((c) => !c.doubtful.includes(part))
    const from = sure.length ? sure : named
    const differ = new Set(from.map((c) => (part === 'hero' ? c.characterId : c[part]))).size > 1
    return { part, card: from[0]!, doubtful: !sure.length || differ, differ }
  }
  const settled = PARTS.map(settle)
  const doubtful = settled.filter((s) => s.doubtful).map((s) => s.part)
  return {
    cards,
    characterId: settled[0]!.card.characterId,
    paragon: settled[1]!.card.paragon,
    refinement: settled[2]!.card.refinement,
    state: doubtful.length ? PART_STATE[doubtful[0]!] : 'sure',
    doubtful,
    edited,
    issues: settled.some((s) => s.differ) ? ['differ'] : [],
  }
}

function teamOf(
  shots: readonly WwwShotInput[],
  at: readonly { shot: number; panel: number }[],
  colour: BarColour,
): WwwTeamPlan {
  const reads = at.flatMap(({ shot, panel }) => {
    const cards = shots[shot]!.reading.panels[panel]![colour].cards
    return cards ? [{ input: shots[shot]!, panel, cards }] : []
  })
  const badges = at.map(({ shot, panel }) => badgeOf(shots[shot]!, panel, colour))
  const picked = badges.filter((b) => b.edited)
  const settled = picked.length ? picked : badges.filter((b) => b.artifactId !== null)
  return {
    slots: (reads[0]?.cards ?? []).map((_, slot) =>
      slotOf(
        reads.flatMap(({ input, panel, cards }) =>
          cards[slot] ? [cardOf(input, cardKey(panel, colour, slot), cards[slot])] : [],
        ),
      ),
    ),
    badges,
    artifactId: settled[0]?.artifactId ?? null,
    artifactEdited: picked.length > 0,
    artifactIssues: new Set(settled.map((b) => b.artifactId)).size > 1 ? ['differ'] : [],
  }
}

// A side fields each hero and each artifact in one place only.
function markRepeats(teams: readonly WwwTeamPlan[]): void {
  const repeated = <T>(items: readonly T[], id: (item: T) => number | null): T[] => {
    const counts = new Map<number, number>()
    for (const item of items) {
      const key = id(item)
      if (key !== null) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return items.filter((item) => {
      const key = id(item)
      return key !== null && counts.get(key)! > 1
    })
  }
  const slots = teams.flatMap((t) => t.slots)
  for (const slot of repeated(slots, (s) => s.characterId)) {
    slot.state = 'duplicate'
    slot.doubtful = []
    slot.issues.push('twice')
  }
  for (const team of repeated(teams, (t) => t.artifactId)) team.artifactIssues.push('twice')
}

const fillTeam = (team: WwwTeamPlan): WwwTeamState => ({
  heroes: team.slots.map(({ characterId, paragon, refinement }) =>
    characterId === null ? null : { id: characterId, paragon, refinement },
  ),
  artifact: team.artifactId,
})

export function buildWwwImportPlan(shots: readonly WwwShotInput[]): WwwImportPlan {
  const { starts, fits } = placeShots(shots)
  const numbers: Record<string, number[]> = {}
  shots.forEach((shot, s) => {
    numbers[shot.id] = shot.reading.panels.map((_, p) => starts[s]! + p + 1)
  })
  const count = Math.max(
    WWW_GAMES,
    ...shots.map((shot, s) => starts[s]! + shot.reading.panels.length),
  )
  // Each game's panels, as screenshot and panel indexes.
  const at = Array.from({ length: count }, (_, g) =>
    shots.flatMap((shot, s) =>
      shot.reading.panels[g - starts[s]!] ? [{ shot: s, panel: g - starts[s]! }] : [],
    ),
  )

  const games = at.map((panels) => {
    const a = teamOf(shots, panels, 'blue')
    const b = teamOf(shots, panels, 'red')
    return a.slots.length && b.slots.length ? { a, b } : null
  })
  for (const colour of COLOURS) {
    markRepeats(games.flatMap((game) => (game ? [game[SIDE_OF[colour]]] : [])))
  }

  const teams = games.flatMap((game) => (game ? [game.a, game.b] : []))
  const slots = teams.flatMap((t) => t.slots)
  return {
    numbers,
    games,
    missing: games.slice(0, WWW_GAMES).flatMap((game, g) => (game ? [] : [g + 1])),
    otherMatch: !fits,
    toCheck:
      slots.filter((s) => s.state !== 'sure' || s.issues.length).length +
      teams.filter((t) => t.artifactIssues.length).length,
    confirmable: slots.filter((s) => s.doubtful.length && !s.issues.length),
    fill: games
      .slice(0, WWW_GAMES)
      .map((game) => game && { a: fillTeam(game.a), b: fillTeam(game.b) }),
    blocked:
      !fits || slots.some((s) => s.issues.length) || teams.some((t) => t.artifactIssues.length),
  }
}
