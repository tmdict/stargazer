/* Saved-team search shared by the Saved Teams tab and the Load menu. Two
 * inputs: picks (the tab's pills, heroes and artifacts taken from the
 * suggestions) and free text. Picks match per lineup, one board's ally or
 * enemy side with its heroes and its artifact, so picks never pair across
 * boards or against the opponent. A team survives when one lineup fields
 * every pick and, with text present, the text hits its name (any length; the
 * returned snippet marks the hit for highlighting) or, at 2+ characters, a
 * hero or the artifact of such a lineup (heroes through matchCharacterNames,
 * the picker search's multi-locale name index; artifacts by their names in the
 * site languages). Phantimals and companion summons never match. Suggestions
 * are the heroes and artifacts the text matches in those lineups, so a pick
 * can never empty the list, and the thumbnail rings mark the picked and
 * text-matched ones in them. */

import { computed, onScopeDispose, ref, watch, type ComputedRef, type Ref } from 'vue'

import { matchCharacterNames } from '@/composables/useSkillSearch'
import {
  isStandardHero,
  lineupArtifactKey,
  lineupHeroKey,
  teamPreviewBoards,
  type PreviewArtifact,
} from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { loadArtifactLocales } from '@/utils/dataLoader'
import { localizedDisplayName } from '@/utils/nameFormatting'
import { renderSnippet, type Snippet } from '@/utils/searchHighlight'
import { curatedHeroName } from '@/utils/skillLabels'

export interface SavedTeamSearchResult {
  team: SavedTeam
  name: Snippet
  // lineupHeroKey and lineupArtifactKey keys of what to ring. Present only
  // when the team fields a picked or text-matched hero or artifact. Every
  // other card gets a stable undefined, so typing never re-renders its
  // thumbnails.
  highlights?: ReadonlySet<string>
}

// One board side's heroes and artifact, as fielded.
interface Lineup {
  board: number
  team: Team
  heroes: ReadonlySet<string>
  // Null with no artifact or a retired seasonal one.
  artifact: string | null
}

export type SearchKind = 'hero' | 'artifact'

// A picked or suggested hero or artifact: its slug (an artifact's name) and
// its chrome-locale name.
export interface SearchPick {
  kind: SearchKind
  slug: string
  label: string
}

type PickRef = Pick<SearchPick, 'kind' | 'slug'>

// The list reacts once typing pauses rather than per keystroke: every filter
// pass re-patches a large card grid, and consecutive passes queue into a
// visible stall on mobile.
const DEBOUNCE_MS = 200

// Hero and artifact matching (filter and suggestions) waits for two
// characters so a single letter can't pull in half the list.
const QUERY_MIN = 2

const MAX_SUGGESTIONS = 8

// Shared across consumers and keyed on the immutable data string (updates
// replace the record), so the tab and the menu never decode a record twice.
const lineupCache = new Map<string, readonly Lineup[]>()

let artifactNames: { slug: string; text: string }[] | undefined

// Artifact names exist in the site languages only.
const matchArtifactNames = (query: string): Set<string> => {
  artifactNames ??= Object.entries(loadArtifactLocales()).flatMap(([slug, names]) =>
    Object.values(names).map((text) => ({ slug, text: text.toLowerCase() })),
  )
  const lc = query.toLowerCase()
  return new Set(artifactNames.filter(({ text }) => text.includes(lc)).map(({ slug }) => slug))
}

const fields = (lineup: Lineup, { kind, slug }: PickRef): boolean =>
  kind === 'hero' ? lineup.heroes.has(slug) : lineup.artifact === slug

export function useSavedTeamSearch(teams: () => readonly SavedTeam[]): {
  query: Ref<string>
  picks: ComputedRef<SearchPick[]>
  suggestions: ComputedRef<SearchPick[]>
  results: ComputedRef<SavedTeamSearchResult[]>
  addPick: (pick: PickRef) => void
  removePick: (pick: PickRef) => void
  clear: () => void
} {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()
  const query = ref('')
  const activeQuery = ref('')
  const picked = ref<PickRef[]>([])
  let debounce: ReturnType<typeof setTimeout> | undefined
  watch(query, (value) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => (activeQuery.value = value.trim()), DEBOUNCE_MS)
  })
  onScopeDispose(() => clearTimeout(debounce))

  const labelled = ({ kind, slug }: PickRef): SearchPick => ({
    kind,
    slug,
    label:
      kind === 'hero'
        ? curatedHeroName(slug, i18n.currentLocale)
        : localizedDisplayName(i18n.t, 'artifact', slug),
  })

  const picks = computed(() => picked.value.map(labelled))

  const isPicked = (kind: SearchKind, slug: string): boolean =>
    picked.value.some((pick) => pick.kind === kind && pick.slug === slug)

  // Bypasses the debounce: text dropped by a pick or a clear must let go of
  // the list at once, not narrow it for one more tick.
  const setQueryNow = (value: string): void => {
    clearTimeout(debounce)
    query.value = value
    activeQuery.value = value
  }

  // A pick also clears the text, so the next term can be typed at once.
  const addPick = ({ kind, slug }: PickRef): void => {
    if (!isPicked(kind, slug)) picked.value = [...picked.value, { kind, slug }]
    setQueryNow('')
  }

  const removePick = ({ kind, slug }: PickRef): void => {
    picked.value = picked.value.filter((pick) => pick.kind !== kind || pick.slug !== slug)
  }

  const clear = (): void => {
    picked.value = []
    setQueryNow('')
  }

  const artifactName = (slot: PreviewArtifact): string | null =>
    typeof slot === 'number' ? (gameData.getArtifactById(slot)?.name ?? null) : null

  // Memoized only once the game data is loaded: an early lookup would pin empty
  // lineups.
  const teamLineups = (team: SavedTeam): readonly Lineup[] => {
    const cached = lineupCache.get(team.data)
    if (cached) return cached
    const lineups: Lineup[] = []
    for (const [board, { units, artifacts }] of (teamPreviewBoards(team.data) ?? []).entries()) {
      const sides = new Map<Team, Set<string>>()
      for (const unit of units) {
        if (!isStandardHero(unit)) continue
        const slug = gameData.getCharacterNameById(unit.characterId)
        if (!slug) continue
        const heroes = sides.get(unit.team) ?? new Set<string>()
        heroes.add(slug)
        sides.set(unit.team, heroes)
      }
      for (const [side, slot] of [
        [Team.ALLY, artifacts.ally],
        [Team.ENEMY, artifacts.enemy],
      ] as const) {
        const heroes = sides.get(side) ?? new Set<string>()
        const artifact = artifactName(slot)
        if (heroes.size || artifact) lineups.push({ board, team: side, heroes, artifact })
      }
    }
    if (gameData.dataLoaded) lineupCache.set(team.data, lineups)
    return lineups
  }

  // The lineups fielding every pick; all of them when nothing is picked.
  const pickedLineups = (team: SavedTeam): readonly Lineup[] => {
    const lineups = teamLineups(team)
    if (picked.value.length === 0) return lineups
    return lineups.filter((lineup) => picked.value.every((pick) => fields(lineup, pick)))
  }

  // Skips the decode with no picks, so a name-only query stays cheap.
  const pickFiltered = computed(() =>
    picked.value.length === 0 ? teams() : teams().filter((team) => pickedLineups(team).length > 0),
  )

  const collator = computed(() => new Intl.Collator(i18n.currentLocale, { sensitivity: 'base' }))

  // Live rather than debounced: Enter takes the lit suggestion, so the list
  // must reflect the text at the moment of the keystroke. Prefix hits on the
  // chrome name lead; the rest follow in collation order.
  const suggestions = computed<SearchPick[]>(() => {
    const q = query.value.trim()
    if (q.length < QUERY_MIN) return []
    const heroes = matchCharacterNames(q)
    const artifacts = matchArtifactNames(q)
    const pool = new Map<string, PickRef>()
    const offer = (kind: SearchKind, slug: string): void => {
      if (!isPicked(kind, slug)) pool.set(`${kind}:${slug}`, { kind, slug })
    }
    for (const team of pickFiltered.value) {
      for (const lineup of pickedLineups(team)) {
        for (const slug of lineup.heroes) if (heroes.has(slug)) offer('hero', slug)
        if (lineup.artifact && artifacts.has(lineup.artifact)) offer('artifact', lineup.artifact)
      }
    }
    const lc = q.toLowerCase()
    const rank = (pick: SearchPick): number => (pick.label.toLowerCase().startsWith(lc) ? 0 : 1)
    return [...pool.values()]
      .map(labelled)
      .sort((a, b) => rank(a) - rank(b) || collator.value.compare(a.label, b.label))
      .slice(0, MAX_SUGGESTIONS)
  })

  // Heroes match the site languages' curated names and any warm locale.
  const matched = computed(() =>
    activeQuery.value.length >= QUERY_MIN
      ? {
          heroes: matchCharacterNames(activeQuery.value),
          artifacts: matchArtifactNames(activeQuery.value),
        }
      : undefined,
  )

  // A card's ring keys, memoized until the picks or the matches change: a
  // sort or filter pass hands each card the same set, so its thumbnail
  // doesn't re-render.
  const ringsFor = computed(() => {
    const ringed = (kind: SearchKind, found: ReadonlySet<string> = new Set()) =>
      new Set([...picked.value.filter((p) => p.kind === kind).map((p) => p.slug), ...found])
    const heroes = ringed('hero', matched.value?.heroes)
    const artifacts = ringed('artifact', matched.value?.artifacts)
    const memo = new Map<string, ReadonlySet<string>>()
    return (team: SavedTeam): ReadonlySet<string> => {
      const cached = memo.get(team.data)
      if (cached) return cached
      const rings = new Set<string>()
      for (const { board, team: side, heroes: fielded, artifact } of pickedLineups(team)) {
        for (const slug of fielded) {
          if (heroes.has(slug)) rings.add(lineupHeroKey(board, side, slug))
        }
        if (artifact && artifacts.has(artifact)) rings.add(lineupArtifactKey(board, side))
      }
      memo.set(team.data, rings)
      return rings
    }
  })

  const plainName = (team: SavedTeam): Snippet => ({ pre: team.name, match: '', post: '' })

  const hasMatch = (
    team: SavedTeam,
    { heroes, artifacts }: { heroes: ReadonlySet<string>; artifacts: ReadonlySet<string> },
  ): boolean =>
    pickedLineups(team).some(
      (lineup) =>
        [...lineup.heroes].some((slug) => heroes.has(slug)) ||
        (lineup.artifact !== null && artifacts.has(lineup.artifact)),
    )

  // Picks narrow first; the text then keeps a card on a name hit or a hero or
  // artifact hit in a picked lineup. Input order is preserved. renderSnippet
  // gets the name's full length as context, so its pieces always spell the
  // whole name. The hero and artifact check runs even for name hits: a
  // name-matched team still rings what matched.
  const results = computed<SavedTeamSearchResult[]>(() => {
    const q = activeQuery.value
    const hasPicks = picked.value.length > 0
    if (!q && !hasPicks) {
      return teams().map((team) => ({ team, name: plainName(team) }))
    }
    const found = matched.value
    return pickFiltered.value.flatMap((team) => {
      const name = q ? renderSnippet(team.name, q, team.name.length) : null
      const hit = !!found && hasMatch(team, found)
      if (q && !name && !hit) return []
      return [
        {
          team,
          name: name ?? plainName(team),
          highlights: hasPicks || hit ? ringsFor.value(team) : undefined,
        },
      ]
    })
  })

  return { query, picks, suggestions, results, addPick, removePick, clear }
}
