/* The model both pages use. From one season's decided games it learns a
 * number for each hero, each recorded five-hero team (how far those five did
 * better or worse together than their heroes alone predict), each hero
 * against each kind of team, each artifact and each artifact on a kind of
 * team, and the worth of one Rivalry point of upgrade gap, all at once by
 * penalised logistic regression (fit.ts). Each kind of number is held toward
 * zero by its own amount, chosen by testing on two seasons, so a hero, team
 * or artifact seen in a few games cannot claim a big effect.
 *
 * A match-up's edge adds each side's numbers. A typical opponent is the
 * average of every side in the season's decided games, so a team against it
 * counts its numbers less that average. Artifact numbers are measured from a
 * typical artifact, that same average, so no artifact, or one the games never
 * show, counts as a typical one. */

import { fit, type Row } from './fit.ts'
import type {
  Explanation,
  Game,
  Matchup,
  Model,
  ModelKind,
  Reason,
  ReasonItem,
  Side,
} from './types.ts'

// Upgrades have no detail lines of the model's.
type ItemReason = Exclude<Reason, 'upgrades'>

const HOLD = { hero: 3, lineup: 3, counter: 5, artifact: 10, artifactOnKind: 20, upgrade: 0.01 }

const GAP = 'gap'
const heroKey = (id: number): string => `h${id}`
const lineupKey = (heroes: readonly number[]): string =>
  `l${[...heroes].sort((a, b) => a - b).join('/')}`
const counterKey = (hero: number, kind: number): string => `c${hero}:${kind}`
const artifactKey = (id: number): string => `a${id}`
const artifactOnKindKey = (id: number, kind: number): string => `k${id}:${kind}`

// The features of one side, signed toward A, as [key, value, hold].
function sideFeatures(
  side: Side,
  other: Side,
  sign: number,
  out: [string, number, number][],
): void {
  for (const h of side.heroes) out.push([heroKey(h), sign, HOLD.hero])
  out.push([lineupKey(side.heroes), sign, HOLD.lineup])
  if (other.kind !== null) {
    for (const h of side.heroes) out.push([counterKey(h, other.kind), sign, HOLD.counter])
  }
  if (side.artifact !== null) {
    out.push([artifactKey(side.artifact), sign, HOLD.artifact])
    if (side.kind !== null) {
      out.push([artifactOnKindKey(side.artifact, side.kind), sign, HOLD.artifactOnKind])
    }
  }
}

function learn(games: Game[]): Model {
  const index = new Map<string, number>()
  const holds: number[] = []
  const rows: Row[] = games.map((g) => {
    const features: [string, number, number][] = [[GAP, g.gap, HOLD.upgrade]]
    sideFeatures(g.a, g.b, 1, features)
    sideFeatures(g.b, g.a, -1, features)
    // The same hero, or the same five, on both sides cancels out.
    const merged = new Map<number, number>()
    for (const [key, value, hold] of features) {
      if (!index.has(key)) {
        index.set(key, holds.length)
        holds.push(hold)
      }
      const j = index.get(key)!
      merged.set(j, (merged.get(j) ?? 0) + value)
    }
    return [...merged].filter(([, value]) => value !== 0)
  })
  const w = fit(
    rows,
    games.map((g) => g.aWon),
    holds,
  )
  const num = (key: string): number => {
    const j = index.get(key)
    return j === undefined ? 0 : w[j]!
  }
  const theta = num(GAP)

  const heroSum = (heroes: readonly number[]): number =>
    heroes.reduce((s, h) => s + num(heroKey(h)), 0) + num(lineupKey(heroes))
  const counter = (hero: number, kind: number | null): number =>
    kind === null ? 0 : num(counterKey(hero, kind))
  const counters = (side: Side, other: Side): number =>
    side.heroes.reduce((s, h) => s + counter(h, other.kind), 0)
  const rawArtifact = (id: number, kind: number | null): number =>
    num(artifactKey(id)) + (kind === null ? 0 : num(artifactOnKindKey(id, kind)))

  const sides = games.flatMap((g) => [g.a, g.b])
  const mean = (value: (side: Side) => number): number =>
    sides.reduce((s, side) => s + value(side), 0) / sides.length
  const typicalArtifact = mean((s) => (s.artifact === null ? 0 : rawArtifact(s.artifact, s.kind)))
  const typicalHeroes = mean((s) => heroSum(s.heroes))
  const artifact = (side: Side): number =>
    side.artifact === null || !index.has(artifactKey(side.artifact))
      ? 0
      : rawArtifact(side.artifact, side.kind) - typicalArtifact

  // The field's kinds, by how many sides were of each.
  const kindShares = new Map<number | null, number>()
  for (const s of sides) kindShares.set(s.kind, (kindShares.get(s.kind) ?? 0) + 1 / sides.length)
  const heroVsField = new Map<number, number>()
  const fieldVsKind = new Map<number, number>()
  const againstField = (side: Side): number => {
    let sum = 0
    for (const h of side.heroes) {
      if (!heroVsField.has(h)) {
        let v = 0
        for (const [kind, share] of kindShares) v += share * counter(h, kind)
        heroVsField.set(h, v)
      }
      sum += heroVsField.get(h)!
    }
    const kind = side.kind
    if (kind === null) return sum
    if (!fieldVsKind.has(kind)) {
      fieldVsKind.set(
        kind,
        mean((s) => s.heroes.reduce((t, h) => t + counter(h, kind), 0)),
      )
    }
    return sum - fieldVsKind.get(kind)!
  }

  const parts = ({ a, b, gap }: Matchup): Explanation['parts'] => ({
    heroes: heroSum(a.heroes) - heroSum(b.heroes),
    counters: counters(a, b) - counters(b, a),
    artifacts: artifact(a) - artifact(b),
    upgrades: theta * gap,
  })

  const items = (side: Side, other: Side, at: 'a' | 'b'): Record<ItemReason, ReasonItem[]> => {
    const lineup = lineupKey(side.heroes)
    const line = (
      subject: ReasonItem['subject'],
      id: number | null,
      value: number,
    ): ReasonItem => ({
      side: at,
      subject,
      id,
      value,
    })
    return {
      heroes: [
        ...side.heroes.map((id) => line('hero', id, num(heroKey(id)))),
        ...(index.has(lineup) ? [line('lineup', null, num(lineup))] : []),
      ],
      counters:
        other.kind === null
          ? []
          : side.heroes.map((id) => line('hero', id, counter(id, other.kind))),
      artifacts: side.artifact === null ? [] : [line('artifact', side.artifact, artifact(side))],
    }
  }

  return {
    edge: (m) => {
      const p = parts(m)
      return p.heroes + p.counters + p.artifacts + p.upgrades
    },
    againstTypical: (side, gap) =>
      heroSum(side.heroes) - typicalHeroes + againstField(side) + artifact(side) + theta * gap,
    explain: (m) => {
      const ofA = items(m.a, m.b, 'a')
      const ofB = items(m.b, m.a, 'b')
      return {
        parts: parts(m),
        items: {
          heroes: [...ofA.heroes, ...ofB.heroes],
          counters: [...ofA.counters, ...ofB.counters],
          artifacts: [...ofA.artifacts, ...ofB.artifacts],
        },
      }
    },
  }
}

export const sharedModel: ModelKind = { id: 'shared', learn }
