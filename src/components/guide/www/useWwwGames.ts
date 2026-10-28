import { computed, readonly, ref } from 'vue'

import { ATTR_PARAGON, ATTR_REFINEMENT, TOP_LEVELS } from '@/lib/characters/attributes'
import { BASE_TEAM_SIZE } from '@/lib/grid'
import {
  WWW_GAMES,
  type WwwGame,
  type WwwLevelAttr,
  type WwwSlotHero,
  type WwwTeamState,
} from '@/lib/pvp/sl/www/match'
import type { TeamSide } from '@/lib/pvp/sl/www/panel'
import { useRosters } from '@/stores/rosters'

export type WwwMode = 'one' | 'match'

export interface WwwSlotAt {
  game: number
  side: TeamSide
  slot: number
}

const emptyTeam = (): WwwTeamState => ({
  heroes: Array.from({ length: BASE_TEAM_SIZE }, () => null),
  artifact: null,
})
const emptyGame = (): WwwGame => ({ a: emptyTeam(), b: emptyTeam() })

const SIDES: readonly TeamSide[] = ['a', 'b']
const other = (side: TeamSide): TeamSide => (side === 'a' ? 'b' : 'a')

/* Who Would Win?'s games, the mode that shows them and the slot the hero grid
 * fills next. One game shows game 1 and Match all five, and the page's buttons
 * act on the games shown. In Match a side fields each hero and each artifact
 * once, as a player does in a match, so its pickers leave out what it fields
 * in its other games. A hero added to Team A starts at the active roster's
 * levels and one added to Team B at the top levels, as the generator treats a
 * visitor and their opponents. The games live in the page alone. */
export function useWwwGames() {
  const rosters = useRosters()
  const mode = ref<WwwMode>('one')
  const games = ref<WwwGame[]>(Array.from({ length: WWW_GAMES }, emptyGame))
  // Always an empty slot of a game shown, or null when they are all full.
  const target = ref<WwwSlotAt | null>({ game: 0, side: 'a', slot: 0 })

  const showing = computed(() => (mode.value === 'one' ? [0] : games.value.map((_, i) => i)))
  const teamAt = (at: { game: number; side: TeamSide }): WwwTeamState =>
    games.value[at.game]![at.side]
  const heroIds = (at: { game: number; side: TeamSide }): number[] =>
    teamAt(at).heroes.flatMap((hero) => (hero ? [hero.id] : []))

  const full = computed(() =>
    showing.value.every((game) =>
      SIDES.every((side) => heroIds({ game, side }).length === BASE_TEAM_SIZE),
    ),
  )

  // What the side fields in Match's other games.
  const elsewhere = (at: { game: number; side: TeamSide }) => {
    const teams =
      mode.value === 'match'
        ? showing.value.flatMap((game) => (game === at.game ? [] : [{ game, side: at.side }]))
        : []
    return {
      heroes: new Set(teams.flatMap(heroIds)),
      artifacts: new Set(teams.flatMap((team) => teamAt(team).artifact ?? [])),
    }
  }

  const startLevels = (side: TeamSide, id: number): Omit<WwwSlotHero, 'id'> => {
    const record = side === 'a' && rosters.active ? (rosters.active.heroes[id] ?? {}) : TOP_LEVELS
    return { paragon: record[ATTR_PARAGON] ?? 0, refinement: record[ATTR_REFINEMENT] ?? 0 }
  }

  // The next empty slot after `from` on its team, then on its game's other
  // team, then in the games shown after it.
  const nextOpen = (from: WwwSlotAt): WwwSlotAt | null => {
    const order = showing.value
    const start = order.indexOf(from.game)
    for (let step = 0; step < order.length; step++) {
      const game = order[(start + step) % order.length]!
      for (const side of [from.side, other(from.side)]) {
        const slots = teamAt({ game, side }).heroes
        for (let k = 1; k <= slots.length; k++) {
          const slot = (from.slot + k) % slots.length
          if (!slots[slot]) return { game, side, slot }
        }
      }
    }
    return null
  }

  const setMode = (next: WwwMode): void => {
    mode.value = next
    if (target.value && !showing.value.includes(target.value.game)) {
      // From before game 1's first slot.
      target.value = nextOpen({ game: 0, side: 'a', slot: -1 })
    }
  }

  // Makes `at` the slot to fill and returns whether it is open for a hero. A
  // hero there is taken off instead, which leaves its slot the one to fill.
  const selectSlot = (at: WwwSlotAt): boolean => {
    target.value = at
    const slots = teamAt(at).heroes
    if (!slots[at.slot]) return true
    slots[at.slot] = null
    return false
  }

  // Fills the target slot with the hero and returns whether it did: a hero
  // already on the target's team is taken off instead.
  const toggleHero = (id: number): boolean => {
    const at = target.value
    if (!at) return false
    const slots = teamAt(at).heroes
    const held = slots.findIndex((hero) => hero?.id === id)
    if (held >= 0) {
      slots[held] = null
      target.value = { ...at, slot: held }
      return false
    }
    slots[at.slot] = { id, ...startLevels(at.side, id) }
    target.value = nextOpen(at)
    return true
  }

  const setLevel = (at: WwwSlotAt, attr: WwwLevelAttr, level: number): void => {
    const hero = teamAt(at).heroes[at.slot]
    if (hero) hero[attr] = level
  }

  const setTeamLevel = (side: TeamSide, attr: WwwLevelAttr, level: number): void => {
    for (const game of showing.value) {
      for (const hero of teamAt({ game, side }).heroes) if (hero) hero[attr] = level
    }
  }

  const setArtifact = (at: { game: number; side: TeamSide }, id: number | null): void => {
    teamAt(at).artifact = id
  }

  const swapSides = (): void => {
    for (const i of showing.value) {
      const game = games.value[i]!
      games.value[i] = { a: game.b, b: game.a }
    }
    if (target.value) target.value = { ...target.value, side: other(target.value.side) }
  }

  const clear = (): void => {
    for (const i of showing.value) games.value[i] = emptyGame()
    target.value = { game: 0, side: 'a', slot: 0 }
  }

  // Replaces all five games, whichever mode is shown, a null one with an empty
  // game, and switches to Match.
  const fill = (next: readonly (WwwGame | null)[]): void => {
    games.value = Array.from({ length: WWW_GAMES }, (_, i) => next[i] ?? emptyGame())
    mode.value = 'match'
    target.value = nextOpen({ game: 0, side: 'a', slot: -1 })
  }

  return {
    mode: readonly(mode),
    games,
    target: readonly(target),
    showing,
    full,
    heroIds,
    elsewhere,
    setMode,
    selectSlot,
    toggleHero,
    setLevel,
    setTeamLevel,
    setArtifact,
    swapSides,
    clear,
    fill,
  }
}
