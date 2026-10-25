import type { SlShownTeam } from './SlResult.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'

// A chance as a whole percentage. One that rounds to 0% or 100% is still
// neither, so it reads as under 1% or over 99%.
export const slPercent = (chance: number): string =>
  chance < 0.005 ? '<1%' : chance > 0.995 ? '>99%' : `${Math.round(chance * 100)}%`

// An emoji beside a chance, by the whole percentage slPercent shows: each
// entry holds from its percentage up to the next.
const MOODS: readonly (readonly [number, string])[] = [
  [99, '👑'],
  [95, '🏆'],
  [90, '🚀'],
  [85, '🔥'],
  [80, '💪'],
  [75, '😎'],
  [70, '🎯'],
  [65, '😄'],
  [60, '🙂'],
  [55, '👍'],
  [50, '🪙'],
  [45, '😐'],
  [40, '🤞'],
  [35, '😬'],
  [30, '😅'],
  [25, '😓'],
  [20, '😰'],
  [15, '😱'],
  [10, '🥶'],
  [5, '🙏'],
  [2, '🕯️'],
  [1, '💀'],
  [0, '🪦'],
]

export const slMood = (chance: number): string => {
  const percent = Math.round(chance * 100)
  return MOODS.find(([from]) => percent >= from)![1]
}

/* A team's group named in the site language: by the name the data file gives
 * it in this language, else by its core heroes, as the guide names a team the
 * report has no name for. */
export function useSlNames() {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()

  const heroSlug = (id: number): string => gameData.getCharacterNameById(id) ?? String(id)

  const groupName = (team: SlShownTeam): string => {
    if (!team.group) return i18n.t('app.sl-no-group')
    const lang = i18n.currentLocale
    return (
      team.group.name[lang] ??
      team.group.core.map((id) => curatedHeroName(heroSlug(id), lang)).join('/')
    )
  }

  return { groupName }
}
