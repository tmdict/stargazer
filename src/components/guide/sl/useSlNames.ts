import { useUnitLabels } from '@/composables/useUnitLabels'
import type { SlFamily } from '@/lib/pvp/data/types'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import type { TextPart } from '@/utils/interpolate'
import { curatedHeroName } from '@/utils/skillLabels'

// A chance as a percentage to one decimal. One that rounds to 0% or 100% is
// still neither, so it reads as under 0.1% or over 99.9%.
export const slPercent = (chance: number): string =>
  chance < 0.0005 ? '<0.1%' : chance > 0.9995 ? '>99.9%' : `${(chance * 100).toFixed(1)}%`

/* A team's group named in the site language: by the name the data file gives
 * it in this language, else by its core heroes, as the guide names a team the
 * report has no name for. A unit named in a board's card: the site's Chinese
 * hero names carry the players' nickname in brackets, and a card uses the
 * nickname alone. */
export function useSlNames() {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()
  const { unitName } = useUnitLabels()

  const heroSlug = (id: number): string => gameData.getCharacterNameById(id) ?? String(id)

  const groupName = (group: Pick<SlFamily, 'name' | 'core'> | null): string => {
    if (!group) return i18n.t('app.sl-no-group')
    const lang = i18n.currentLocale
    return group.name[lang] ?? group.core.map((id) => curatedHeroName(heroSlug(id), lang)).join('/')
  }

  const cardName = (unit: number): string => {
    const name = unitName(unit)
    return (i18n.currentLocale === 'zh' && name.match(/\(([^)]+)\)$/)?.[1]) || name
  }

  const cardNames = (units: readonly number[]): TextPart[] =>
    new Intl.ListFormat(i18n.currentLocale, { type: 'conjunction' })
      .formatToParts(units.map(cardName))
      .map(({ type, value }) => ({ text: value, marked: type === 'element' }))

  return { groupName, cardName, cardNames }
}
