/* Saved-team search shared by the Saved Teams tab and the Load menu: a query
 * keeps a team visible on a name hit (any length; the returned snippet marks
 * the hit for highlighting) or, at 2+ characters, on a hero placed on its
 * boards (matchCharacterNames, the roster search's multi-locale name index).
 * Phantimals and companion summons never match. */

import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { matchCharacterNames } from '@/composables/useSkillSearch'
import { isStandardHero, teamPreviewBoards } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { useGameDataStore } from '@/stores/gameData'
import { renderSnippet, type Snippet } from '@/utils/searchHighlight'

export interface SavedTeamSearchResult {
  team: SavedTeam
  name: Snippet
}

// Shared across consumers and keyed on the immutable data string (updates
// replace the record), so the tab and the menu never decode a record twice.
const heroSlugCache = new Map<string, ReadonlySet<string>>()

export function useSavedTeamSearch(teams: () => readonly SavedTeam[]): {
  query: Ref<string>
  matchedHeroes: ComputedRef<ReadonlySet<string> | undefined>
  results: ComputedRef<SavedTeamSearchResult[]>
} {
  const gameData = useGameDataStore()
  const query = ref('')
  const activeQuery = computed(() => query.value.trim())

  // Matches any warm locale (en/zh always are). Gated to 2+ characters so a
  // single letter can't pull in half the roster.
  const matchedHeroes = computed<ReadonlySet<string> | undefined>(() =>
    activeQuery.value.length >= 2 ? matchCharacterNames(activeQuery.value) : undefined,
  )

  // Memoized only once the roster is loaded: an early lookup would pin an
  // empty set.
  const teamHeroSlugs = (team: SavedTeam): ReadonlySet<string> => {
    const cached = heroSlugCache.get(team.data)
    if (cached) return cached
    const slugs = new Set<string>()
    for (const board of teamPreviewBoards(team.data) ?? []) {
      for (const unit of board.units) {
        if (!isStandardHero(unit)) continue
        const slug = gameData.getCharacterNameById(unit.characterId)
        if (slug) slugs.add(slug)
      }
    }
    if (gameData.dataLoaded) heroSlugCache.set(team.data, slugs)
    return slugs
  }

  // A card survives on a name hit or a hero hit; input order is preserved.
  // renderSnippet gets the name's full length as context, so its pieces always
  // spell the whole name.
  const results = computed<SavedTeamSearchResult[]>(() => {
    const q = activeQuery.value
    if (!q) {
      return teams().map((team) => ({ team, name: { pre: team.name, match: '', post: '' } }))
    }
    const heroes = matchedHeroes.value
    return teams().flatMap((team) => {
      const name = renderSnippet(team.name, q, team.name.length)
      const heroHit = !name && !!heroes && [...teamHeroSlugs(team)].some((slug) => heroes.has(slug))
      if (!name && !heroHit) return []
      return [{ team, name: name ?? { pre: team.name, match: '', post: '' } }]
    })
  })

  return { query, matchedHeroes, results }
}
