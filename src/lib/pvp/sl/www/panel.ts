/* Who Would Win?'s result for two teams at their levels: each side's chance
 * from the model, the verdict, the four reasons in points of chance with the
 * detail behind each, the records shown beside them, and warnings where the
 * records are thin. Each team's kind comes from the kind rule, and an
 * artifact the data file has no games for, or whose id named another
 * artifact in the file's season, counts as a typical one. A team of fewer
 * than five heroes has empty slots, which the model counts and the page
 * warns of. */

import { decidedGames, TEAM_HEROES } from '../data/games.ts'
import { gamesIn, seasonRecords, type WinLoss } from '../data/records.ts'
import type { SlData } from '../data/types.ts'
import { emptyShortfall, rivalryPoints, shortfall } from '../data/upgrades.ts'
import type { SlPick } from '../generator/types.ts'
import type { SlLearned } from '../model/models.ts'
import { splitChance } from '../model/reasons.ts'
import type { Reason, ReasonItem, Side } from '../model/types.ts'

export type TeamSide = 'a' | 'b'

export type Pair<T> = Record<TeamSide, T>

export interface WwwTeam {
  heroes: SlPick[]
  artifact: number | null
}

// The verdict's bands, by the favourite's shown chance in tenths of a point:
// how often the model's calls in each came true on games it had not seen.
type Verdict = 'close' | 'slight' | 'favoured' | 'strong'
const VERDICTS: readonly (readonly [number, Verdict])[] = [
  [800, 'strong'],
  [700, 'favoured'],
  [600, 'slight'],
  [0, 'close'],
]

// Fewer games than these and the page warns, or calls a counter record thin.
const FEW_GAMES = 20
const THIN_COUNTER = 10
// The heroes the Upgrades detail names on each side.
const SHORT_HEROES = 3

// A hero, the five heroes together or an empty slot, with its number toward
// its own team on the model's scale.
export interface WwwLine {
  side: TeamSide
  subject: ReasonItem['subject']
  // Null for the lineup and an empty slot.
  id: number | null
  value: number
  // Null where the records are too thin to show.
  record: WinLoss | null
}

interface WwwArtifactLine {
  id: number | null
  value: number
  // Null when the team has no artifact or the file has no games for it.
  record: WinLoss | null
  // Null as well when the team is outside every group.
  onKind: WinLoss | null
}

export type WwwWarning =
  | { type: 'hero-unrecorded'; hero: number }
  | { type: 'hero-few'; hero: number; games: number }
  | { type: 'artifact-unrecorded'; artifact: number }
  | { type: 'artifact-few-on-kind'; artifact: number; games: number }
  | { type: 'no-group'; side: TeamSide }
  | { type: 'empty-slots'; side: TeamSide }

export interface WwwPanel {
  // A's chance as shown, in tenths of a point.
  shown: number
  verdict: Verdict
  // Each reason in tenths of a point toward A; they add up to shown - 500.
  reasons: Record<Reason, number>
  // Index into the file's families; null outside every group.
  kinds: Pair<number | null>
  heroes: WwwLine[]
  counters: WwwLine[]
  artifacts: Pair<WwwArtifactLine>
  points: Pair<number>
  // Each hero below the top levels, and each empty slot with a null id.
  short: Pair<{ id: number | null; points: number }[]>
  lineups: Pair<WinLoss | null>
  // Each lineup's wins in their games against each other.
  met: Pair<number>
  heroGames: Pair<[fewest: number, most: number]>
  warnings: WwwWarning[]
}

const recordOrNull = (record: WinLoss, least = 1): WinLoss | null =>
  gamesIn(record) >= least ? record : null

const strongestFirst = (lines: WwwLine[]): WwwLine[] => [...lines].sort((x, y) => y.value - x.value)

export function wwwPanel(
  data: SlData,
  learned: SlLearned,
  teams: Pair<WwwTeam>,
  counts: (artifact: number) => boolean,
): WwwPanel {
  const recorded = seasonRecords(decidedGames(data))
  const heroIds = (side: TeamSide): number[] => teams[side].heroes.map((h) => h.id)
  const kinds: Pair<number | null> = {
    a: learned.kindOf(heroIds('a')),
    b: learned.kindOf(heroIds('b')),
  }
  const known = (artifact: number | null): artifact is number =>
    artifact !== null && counts(artifact) && gamesIn(recorded.artifact(artifact)) > 0
  const sideOf = (side: TeamSide): Side => ({
    heroes: heroIds(side),
    kind: kinds[side],
    artifact: known(teams[side].artifact) ? teams[side].artifact : null,
  })
  const pointsOf = (side: TeamSide): number =>
    teams[side].heroes.reduce((sum, h) => sum + rivalryPoints(data.prices, h), 0)
  const points = { a: pointsOf('a'), b: pointsOf('b') }
  const matchup = { a: sideOf('a'), b: sideOf('b'), gap: points.a - points.b }
  const { parts, items } = learned.model.explain(matchup)
  const { shown, reasons } = splitChance(parts)
  const favourite = Math.max(shown, 1000 - shown)

  const otherSide = (side: TeamSide): TeamSide => (side === 'a' ? 'b' : 'a')
  const shared = new Set(heroIds('a').filter((id) => heroIds('b').includes(id)))
  const sameLineup = shared.size === teams.a.heroes.length && shared.size === teams.b.heroes.length
  const empty = (side: TeamSide): number => TEAM_HEROES - teams[side].heroes.length
  // What both teams field cancels out and is not shown: a hero on both, the
  // same five, and the empty slots both have.
  const emptyOnBoth = Math.min(empty('a'), empty('b'))
  const emptySeen = { a: 0, b: 0 }
  const shows = (item: ReasonItem): boolean => {
    if (item.subject === 'empty') return ++emptySeen[item.side] > emptyOnBoth
    return item.id === null ? !sameLineup : !shared.has(item.id)
  }
  const heroLine = (item: ReasonItem): WwwLine => ({
    side: item.side,
    subject: item.subject,
    id: item.id,
    value: item.value,
    record:
      item.subject === 'empty'
        ? null
        : item.id === null
          ? recorded.lineup(heroIds(item.side))
          : recordOrNull(recorded.hero(item.id)),
  })
  const counterLine = (item: ReasonItem): WwwLine => ({
    side: item.side,
    subject: 'hero',
    id: item.id,
    value: item.value,
    record: recordOrNull(
      recorded.heroAgainst(item.id!, kinds[otherSide(item.side)]!),
      THIN_COUNTER,
    ),
  })

  const artifactLine = (side: TeamSide): WwwArtifactLine => {
    const id = teams[side].artifact
    const kind = kinds[side]
    const value = items.artifacts?.find((item) => item.side === side)?.value ?? 0
    if (!known(id)) return { id, value, record: null, onKind: null }
    return {
      id,
      value,
      record: recorded.artifact(id),
      onKind: kind === null ? null : recorded.artifactOn(id, kind),
    }
  }

  const shortOf = (side: TeamSide): { id: number | null; points: number }[] =>
    [
      ...teams[side].heroes.map((h) => ({ id: h.id, points: shortfall(data.prices, h) })),
      ...Array.from({ length: empty(side) }, () => ({
        id: null,
        points: emptyShortfall(data.prices),
      })),
    ]
      .filter((h) => h.points > 0)
      .sort((x, y) => y.points - x.points)
      .slice(0, SHORT_HEROES)

  const heroGamesOf = (side: TeamSide): [number, number] => {
    const games = heroIds(side).map((id) => gamesIn(recorded.hero(id)))
    return [Math.min(...games), Math.max(...games)]
  }

  const warnings: WwwWarning[] = []
  const warned = new Set<string>()
  const warn = (key: string, warning: WwwWarning): void => {
    if (warned.has(key)) return
    warned.add(key)
    warnings.push(warning)
  }
  for (const side of ['a', 'b'] as const) {
    for (const id of heroIds(side)) {
      const games = gamesIn(recorded.hero(id))
      if (games === 0) warn(`h${id}`, { type: 'hero-unrecorded', hero: id })
      else if (games < FEW_GAMES) warn(`h${id}`, { type: 'hero-few', hero: id, games })
    }
  }
  for (const side of ['a', 'b'] as const) {
    const id = teams[side].artifact
    const kind = kinds[side]
    if (id === null) continue
    if (!known(id)) warn(`a${id}`, { type: 'artifact-unrecorded', artifact: id })
    else if (kind !== null) {
      const games = gamesIn(recorded.artifactOn(id, kind))
      if (games < FEW_GAMES) {
        warn(`k${id}:${kind}`, { type: 'artifact-few-on-kind', artifact: id, games })
      }
    }
  }
  for (const side of ['a', 'b'] as const) {
    if (kinds[side] === null) warn(`g${side}`, { type: 'no-group', side })
  }
  for (const side of ['a', 'b'] as const) {
    if (empty(side) > 0) warn(`e${side}`, { type: 'empty-slots', side })
  }

  const met = recorded.headToHead(heroIds('a'), heroIds('b'))
  return {
    shown,
    verdict: VERDICTS.find(([from]) => favourite >= from)![1],
    reasons,
    kinds,
    heroes: strongestFirst((items.heroes ?? []).filter(shows).map(heroLine)),
    counters: strongestFirst((items.counters ?? []).map(counterLine)),
    artifacts: { a: artifactLine('a'), b: artifactLine('b') },
    points,
    short: { a: shortOf('a'), b: shortOf('b') },
    lineups: {
      a: recordOrNull(recorded.lineup(heroIds('a'))),
      b: recordOrNull(recorded.lineup(heroIds('b'))),
    },
    met: { a: met.wins, b: met.losses },
    heroGames: { a: heroGamesOf('a'), b: heroGamesOf('b') },
    warnings,
  }
}
