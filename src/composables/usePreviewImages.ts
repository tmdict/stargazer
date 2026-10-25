import type { ThumbnailArtifact, ThumbnailUnit } from '@/components/grid/BoardThumbnail.vue'
import { toPhantimalId } from '@/lib/characters/phantimal'
import type { PreviewArtifact, PreviewUnit } from '@/lib/teams/preview'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

/* The images of a decoded team's units and artifacts (lib/teams/preview), for
 * the boards drawn from encoded team data: saved-team thumbnails and the
 * Supreme League generator's sets. Retired seasonal content becomes an "S{n}"
 * placeholder instead of resolving its reused id. */
export function usePreviewImages() {
  const gameData = useGameDataStore()
  const i18n = useI18nStore()

  const retired = (season: number) => ({
    label: `S${season}`,
    title: i18n.t('app.seasonal-retired', { n: season }),
  })

  const unitImage = (unit: PreviewUnit): string | undefined => {
    if (unit.characterId !== undefined) {
      // Companion-aware: the store maps companion ids to the main hero's
      // portrait or the skill's custom companion image.
      const name = gameData.getCharacterImageNameById(unit.characterId)
      const image = name ? gameData.getCharacterImage(name) : ''
      return image || undefined
    }
    if (unit.phantimalLocal !== undefined) {
      // Band-local, so a phantimal's companion resolves too.
      const slug = gameData.getPhantimalUnitSlug(toPhantimalId(unit.phantimalLocal))
      return (slug && gameData.getCharacterImage(slug)) || undefined
    }
    return undefined
  }

  const thumbnailUnit = (unit: PreviewUnit): ThumbnailUnit =>
    unit.retiredSeason !== undefined
      ? { hexId: unit.hexId, team: unit.team, ...retired(unit.retiredSeason) }
      : { hexId: unit.hexId, team: unit.team, image: unitImage(unit) }

  const thumbnailArtifact = (slot: PreviewArtifact): ThumbnailArtifact | undefined => {
    if (slot === null) return undefined
    if (typeof slot !== 'number') return retired(slot.retiredSeason)
    const artifact = gameData.getArtifactById(slot)
    if (!artifact) return undefined
    const image = gameData.getArtifactImage(artifact.name)
    return image ? { image } : undefined
  }

  return { thumbnailUnit, thumbnailArtifact }
}
