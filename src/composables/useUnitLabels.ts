/* How the screenshot import names and pictures a unit: a hero by its
 * localised name, a hero's companion by its owner's name, marked, and a
 * phantimal and the companion it brings by their own art (Wedge of Power). */

import { isCompanionUnitId, toBaseHeroId } from '@/lib/characters/character'
import { inPhantimalBand } from '@/lib/characters/phantimal'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { phantimalImageUrl } from '@/utils/artifactImage'
import { localizedDisplayName, phantimalDisplayName } from '@/utils/nameFormatting'

export function useUnitLabels(): {
  heroName: (characterId: number | null) => string
  heroImage: (characterId: number | null) => string
  unitName: (unitId: number | null) => string
  unitImage: (unitId: number | null) => string
} {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()

  const heroName = (characterId: number | null): string => {
    if (characterId === null) return i18n.t('app.import-none')
    const slug = gameData.getCharacterNameById(characterId)
    return slug ? localizedDisplayName(i18n.t, 'character', slug) : String(characterId)
  }

  const heroImage = (characterId: number | null): string => {
    const slug = characterId === null ? undefined : gameData.getCharacterNameById(characterId)
    return slug ? gameData.getCharacterImage(slug) : ''
  }

  const unitName = (unitId: number | null): string => {
    if (unitId === null) return i18n.t('app.import-none')
    if (inPhantimalBand(unitId)) {
      return phantimalDisplayName(i18n.currentLocale, gameData.getPhantimalUnitSlug(unitId) ?? '')
    }
    const name = heroName(toBaseHeroId(unitId))
    return isCompanionUnitId(unitId) ? i18n.t('app.import-companion', { name }) : name
  }

  const unitImage = (unitId: number | null): string => {
    const name = unitId === null ? undefined : gameData.getCharacterImageNameById(unitId)
    if (!name) return ''
    return inPhantimalBand(unitId!) ? phantimalImageUrl(name) : gameData.getCharacterImage(name)
  }

  return { heroName, heroImage, unitName, unitImage }
}
