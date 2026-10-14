/* Rows the hero and phantimal hover cards have in common, so both label and
   icon them the same way. */

import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

export function useUnitTooltipRows() {
  const i18n = useI18nStore()
  const gameDataStore = useGameDataStore()

  const traitRow = (trait: 'faction' | 'class' | 'damage', value: string) => ({
    label: `${i18n.t(`game.${trait}`)}:`,
    value: i18n.t(`game.${value}`),
    icon: gameDataStore.getIcon(`${trait}-${value}`),
  })

  const rangeRow = (range: number) => ({ label: `${i18n.t('game.range')}:`, value: range })

  return { traitRow, rangeRow }
}
