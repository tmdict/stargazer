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
    const unitId =
      unit.phantimalLocal !== undefined ? toPhantimalId(unit.phantimalLocal) : unit.characterId
    const name = unitId === undefined ? undefined : gameData.getCharacterImageNameById(unitId)
    return (name && gameData.getCharacterImage(name)) || undefined
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
