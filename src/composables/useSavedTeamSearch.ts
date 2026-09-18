/* Saved-team search shared by the Saved Teams tab and the Load menu. Two
 * inputs: picked heroes (the tab's pills, slugs taken from the suggestions)
 * and free text. Heroes match per lineup, one board's ally or enemy side, so
 * picks never pair across boards or against the opponent. A team survives
 * when one lineup fields every picked hero and, with text present, the text
 * hits its name (any length; the returned snippet marks the hit for
 * highlighting) or, at 2+ characters, a hero in such a lineup
 * (matchCharacterNames, the roster search's multi-locale name index).
 * Phantimals and companion summons never match. Suggestions are the heroes
 * the text matches in those lineups, so a pick can never empty the list, and
 * the thumbnail rings mark the picked and text-matched heroes in them. */

import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'

import { matchCharacterNames } from '@/composables/useSkillSearch'
import { isStandardHero, lineupHeroKey, teamPreviewBoards } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import type { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { renderSnippet, type Snippet } from '@/utils/searchHighlight'
import { curatedHeroName } from '@/utils/skillLabels'

export interface SavedTeamSearchResult {
  team: SavedTeam
  name: Snippet
  // lineupHeroKey keys of the heroes to ring. Present only when the team
  // fields a picked or text-matched hero. Every other card gets a stable
  // undefined, so typing never re-renders its thumbnails.
  highlightHeroes?: ReadonlySet<string>
}

// One board side's heroes, as fielded.
interface Lineup {
  board: number
  team: Team
  heroes: ReadonlySet<string>
}

// A picked or suggested hero: the slug plus its chrome-locale name.
export interface SearchHero {
  slug: string
  label: string
}

// The list reacts once typing pauses rather than per keystroke: every filter
// pass re-patches a large card grid, and consecutive passes queue into a
// visible stall on mobile.
const DEBOUNCE_MS = 200

// Hero matching (filter and suggestions) waits for two characters so a single
// letter can't pull in half the roster.
const HERO_QUERY_MIN = 2

const MAX_SUGGESTIONS = 8

// Shared across consumers and keyed on the immutable data string (updates
// replace the record), so the tab and the menu never decode a record twice.
const lineupCache = new Map<string, readonly Lineup[]>()

export function useSavedTeamSearch(teams: () => readonly SavedTeam[]): {
  query: Ref<string>
  heroes: ComputedRef<SearchHero[]>
  suggestions: ComputedRef<SearchHero[]>
  results: ComputedRef<SavedTeamSearchResult[]>
  addHero: (slug: string) => void
  removeHero: (slug: string) => void
  clear: () => void
} {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()
  const query = ref('')
  const activeQuery = ref('')
  const heroSlugs = ref<string[]>([])
  let debounce: ReturnType<typeof setTimeout> | undefined
  watch(query, (value) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => (activeQuery.value = value.trim()), DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(debounce))

  const labelled = (slug: string): SearchHero => ({
    slug,
    label: curatedHeroName(slug, i18n.currentLocale),
  })

  const heroes = computed(() => heroSlugs.value.map(labelled))

  // Bypasses the debounce: text dropped by a pick or a clear must let go of
  // the list at once, not narrow it for one more tick.
  const setQueryNow = (value: string): void => {
    clearTimeout(debounce)
    query.value = value
    activeQuery.value = value
  }

  // A pick also clears the text, so the next term can be typed at once.
  const addHero = (slug: string): void => {
    if (!heroSlugs.value.includes(slug)) heroSlugs.value = [...heroSlugs.value, slug]
    setQueryNow('')
  }

  const removeHero = (slug: string): void => {
    heroSlugs.value = heroSlugs.value.filter((picked) => picked !== slug)
  }

  const clear = (): void => {
    heroSlugs.value = []
    setQueryNow('')
  }

  // Memoized only once the roster is loaded: an early lookup would pin empty
  // lineups.
  const teamLineups = (team: SavedTeam): readonly Lineup[] => {
    const cached = lineupCache.get(team.data)
    if (cached) return cached
    const lineups: Lineup[] = []
    for (const [board, { units }] of (teamPreviewBoards(team.data) ?? []).entries()) {
      const sides = new Map<Team, Set<string>>()
      for (const unit of units) {
        if (!isStandardHero(unit)) continue
        const slug = gameData.getCharacterNameById(unit.characterId)
        if (!slug) continue
        const heroes = sides.get(unit.team) ?? new Set<string>()
        heroes.add(slug)
        sides.set(unit.team, heroes)
      }
      for (const [side, heroes] of sides) lineups.push({ board, team: side, heroes })
    }
    if (gameData.dataLoaded) lineupCache.set(team.data, lineups)
    return lineups
  }

  // The lineups fielding every pick; all of them when nothing is picked.
  const pickedLineups = (team: SavedTeam): readonly Lineup[] => {
    const picked = heroSlugs.value
    const lineups = teamLineups(team)
    if (picked.length === 0) return lineups
    return lineups.filter((lineup) => picked.every((slug) => lineup.heroes.has(slug)))
  }

  // Skips the decode with no picks, so a name-only query stays cheap.
  const heroFiltered = computed(() =>
    heroSlugs.value.length === 0
      ? teams()
      : teams().filter((team) => pickedLineups(team).length > 0),
  )

  const collator = computed(() => new Intl.Collator(i18n.currentLocale, { sensitivity: 'base' }))

  // Live rather than debounced: Enter takes the lit suggestion, so the list
  // must reflect the text at the moment of the keystroke. Prefix hits on the
  // chrome name lead; the rest follow in collation order.
  const suggestions = computed<SearchHero[]>(() => {
    const q = query.value.trim()
    if (q.length < HERO_QUERY_MIN) return []
    const matched = matchCharacterNames(q)
    const picked = heroSlugs.value
    const pool = new Set<string>()
    for (const team of heroFiltered.value) {
      for (const lineup of pickedLineups(team)) {
        for (const slug of lineup.heroes) {
          if (matched.has(slug) && !picked.includes(slug)) pool.add(slug)
        }
      }
    }
    const lc = q.toLowerCase()
    const rank = (hero: SearchHero): number => (hero.label.toLowerCase().startsWith(lc) ? 0 : 1)
    return [...pool]
      .map(labelled)
      .sort((a, b) => rank(a) - rank(b) || collator.value.compare(a.label, b.label))
      .slice(0, MAX_SUGGESTIONS)
  })

  // Matches any warm locale (en/zh always are).
  const matchedHeroes = computed<ReadonlySet<string> | undefined>(() =>
    activeQuery.value.length >= HERO_QUERY_MIN ? matchCharacterNames(activeQuery.value) : undefined,
  )

  // A card's ring keys, memoized until the picks or the matched heroes
  // change: a sort or filter pass hands each card the same set, so its
  // thumbnail doesn't re-render.
  const ringsFor = computed(() => {
    const ringed = new Set([...heroSlugs.value, ...(matchedHeroes.value ?? [])])
    const memo = new Map<string, ReadonlySet<string>>()
    return (team: SavedTeam): ReadonlySet<string> => {
      const cached = memo.get(team.data)
      if (cached) return cached
      const rings = new Set<string>()
      for (const { board, team: side, heroes } of pickedLineups(team)) {
        for (const slug of heroes) {
          if (ringed.has(slug)) rings.add(lineupHeroKey(board, side, slug))
        }
      }
      memo.set(team.data, rings)
      return rings
    }
  })

  const plainName = (team: SavedTeam): Snippet => ({ pre: team.name, match: '', post: '' })

  const hasMatchedHero = (team: SavedTeam, heroes: ReadonlySet<string>): boolean => {
    for (const lineup of pickedLineups(team)) {
      for (const slug of lineup.heroes) if (heroes.has(slug)) return true
    }
    return false
  }

  // Picked heroes narrow first; the text then keeps a card on a name hit or a
  // hero hit in a picked lineup. Input order is preserved. renderSnippet gets
  // the name's full length as context, so its pieces always spell the whole
  // name. The hero check runs even for name hits: a name-matched team still
  // rings its matched heroes.
  const results = computed<SavedTeamSearchResult[]>(() => {
    const q = activeQuery.value
    const hasPicks = heroSlugs.value.length > 0
    if (!q && !hasPicks) {
      return teams().map((team) => ({ team, name: plainName(team) }))
    }
    const heroes = matchedHeroes.value
    return heroFiltered.value.flatMap((team) => {
      const name = q ? renderSnippet(team.name, q, team.name.length) : null
      const heroHit = !!heroes && hasMatchedHero(team, heroes)
      if (q && !name && !heroHit) return []
      return [
        {
          team,
          name: name ?? plainName(team),
          highlightHeroes: hasPicks || heroHit ? ringsFor.value(team) : undefined,
        },
      ]
    })
  })

  return { query, heroes, suggestions, results, addHero, removeHero, clear }
}
