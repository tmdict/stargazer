import type { SlShownTeam } from './SlResult.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'

// A chance as a percentage to one decimal. One that rounds to 0% or 100% is
// still neither, so it reads as under 0.1% or over 99.9%.
export const slPercent = (chance: number): string =>
  chance < 0.0005 ? '<0.1%' : chance > 0.9995 ? '>99.9%' : `${(chance * 100).toFixed(1)}%`

// An emoji beside a chance, by the percentage slPercent shows: each entry
// holds from its percentage up to the next.
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
  const percent = Math.round(chance * 1000) / 10
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
