/* Reads the model the data file carries. The external report generator owns
 * the file's format and publishes what each number means; this code follows it. */

import { kindRule, type KindOf } from '../data/kinds'
import { seasonRecords, type SeasonRecords } from '../data/records'
import { lineupKey, TEAM_HEROES, type Side } from '../data/sides'
import type { SlData, SlModel, SlRow } from '../data/types'
import type { Explanation, Matchup, Model, Reason, ReasonItem } from './types'

// Upgrades have no detail lines.
type ItemReason = Exclude<Reason, 'upgrades'>

function readModel(m: SlModel): Model {
  const number = (row: readonly number[] | undefined): number => row?.[0] ?? 0
  const lineup = (heroes: readonly number[]): SlRow | undefined => m.lineups[lineupKey(heroes)]

  const heroTotal = (heroes: readonly number[]): number =>
    heroes.reduce((sum, h) => sum + number(m.heroes[h]), 0) +
    number(lineup(heroes)) +
    (TEAM_HEROES - heroes.length) * m.emptySlot
  const counter = (hero: number, kind: number | null): number =>
    kind === null ? 0 : number(m.counters[`${hero}:${kind}`])
  const counters = (side: Side, other: Side): number =>
    side.heroes.reduce((sum, h) => sum + counter(h, other.kind), 0)
  const artifact = ({ artifact: id, kind }: Side): number => {
    if (id === null || !m.artifacts[id]) return 0
    const onKind = kind === null ? 0 : number(m.artifactsOnKind[`${id}:${kind}`])
    return number(m.artifacts[id]) + onKind - m.typicalArtifact
  }
  const againstField = ({ heroes, kind }: Side): number =>
    heroes.reduce((sum, h) => sum + (m.heroes[h]?.[3] ?? 0), 0) -
    (kind === null ? 0 : (m.fieldAgainst[kind] ?? 0))

  const parts = ({ a, b, gap }: Matchup): Explanation['parts'] => ({
    heroes: heroTotal(a.heroes) - heroTotal(b.heroes),
    counters: counters(a, b) - counters(b, a),
    artifacts: artifact(a) - artifact(b),
    upgrades: m.gap * gap,
  })

  const items = (side: Side, other: Side, at: 'a' | 'b'): Record<ItemReason, ReasonItem[]> => {
    const line = (
      subject: ReasonItem['subject'],
      id: number | null,
      value: number,
    ): ReasonItem => ({ side: at, subject, id, value })
    const own = lineup(side.heroes)
    return {
      heroes: [
        ...side.heroes.map((id) => line('hero', id, number(m.heroes[id]))),
        ...(own ? [line('lineup', null, own[0])] : []),
        ...Array.from({ length: TEAM_HEROES - side.heroes.length }, () =>
          line('empty', null, m.emptySlot),
        ),
      ],
      counters:
        other.kind === null
          ? []
          : side.heroes.map((id) => line('hero', id, counter(id, other.kind))),
      artifacts: side.artifact === null ? [] : [line('artifact', side.artifact, artifact(side))],
    }
  }

  return {
    againstTypical: (side, gap) =>
      heroTotal(side.heroes) - m.typicalHeroes + againstField(side) + artifact(side) + m.gap * gap,
    explain: (matchup) => {
      const ofA = items(matchup.a, matchup.b, 'a')
      const ofB = items(matchup.b, matchup.a, 'b')
      return {
        parts: parts(matchup),
        items: {
          heroes: [...ofA.heroes, ...ofB.heroes],
          counters: [...ofA.counters, ...ofB.counters],
          artifacts: [...ofA.artifacts, ...ofB.artifacts],
        },
      }
    },
  }
}

// What the pages read from one file, read once per file: the model, its
// records, and the kind rule for teams the file does not hold as a recorded
// team.
export interface SlReader {
  model: Model
  records: SeasonRecords
  kindOf: KindOf
}

export const readSlFile = (data: SlData): SlReader => ({
  model: readModel(data.model),
  records: seasonRecords(data.model),
  kindOf: kindRule(data.teams),
})
