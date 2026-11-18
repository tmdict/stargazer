// Honor Duel's equipment and artifacts: the data files, display names and
// pictures, and the data pack's text, the creatures' skills with it, one lazy
// chunk per language. Only the Honor Duel tab, the mode's popups, an Honor Duel
// board and the shop calculator page import this module, so none of it loads
// until one of them is opened.

import type {
  DuelArtifact,
  DuelArtifactText,
  DuelCreatureText,
  DuelEquipment,
  DuelEquipmentText,
  EquipmentTier,
  HonorDuelItem,
  HonorDuelText,
} from '@/lib/types/honorDuel'
import { APP_LOCALES, type AppLocale, type LocaleData, type SkillLocale } from '@/lib/types/i18n'
import { fileStem } from '@/utils/fileStem'
import { formatDisplayName } from '@/utils/nameFormatting'
import { gameLabel } from '@/utils/skillLabels'

const byStem = <T>(modules: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(modules).map(([path, value]) => [fileStem(path), value]))

const byId = <T extends { id: number }>(modules: Record<string, T>): T[] =>
  Object.values(modules).sort((a, b) => a.id - b.id)

export const duelEquipment: readonly DuelEquipment[] = byId(
  import.meta.glob<DuelEquipment>('@/data/hd/equipment/*.json', {
    eager: true,
    import: 'default',
  }),
)

export const duelArtifacts: readonly DuelArtifact[] = byId(
  import.meta.glob<DuelArtifact>('@/data/hd/artifact/*.json', {
    eager: true,
    import: 'default',
  }),
)

const equipmentById = new Map(duelEquipment.map((item) => [item.id, item]))
const artifactById = new Map(duelArtifacts.map((item) => [item.id, item]))

// A board holds a piece or an artifact by its id; one that names none reads
// as none.
export const duelEquipmentById = (id: number): DuelEquipment | undefined => equipmentById.get(id)
export const duelArtifactById = (id: number): DuelArtifact | undefined => artifactById.get(id)

const names = {
  equipment: byStem(
    import.meta.glob<LocaleData>('@/locales/hd/equipment/*.json', {
      eager: true,
      import: 'default',
    }),
  ),
  artifact: byStem(
    import.meta.glob<LocaleData>('@/locales/hd/artifact/*.json', {
      eager: true,
      import: 'default',
    }),
  ),
}

// The icons are cut-outs of differing shapes, so each is fitted inside a
// square instead of cropped to one.
const images = {
  equipment: byStem(
    import.meta.glob<string>('@/pack/images/hd/equipment/*.png', {
      query: { format: 'webp', quality: 80, w: 128, h: 128, fit: 'inside' },
      eager: true,
      import: 'default',
    }),
  ),
  artifact: byStem(
    import.meta.glob<string>('@/pack/images/hd/artifact/*.png', {
      query: { format: 'webp', quality: 80, w: 128, h: 128, fit: 'inside' },
      eager: true,
      import: 'default',
    }),
  ),
}

export const duelItemName = ({ kind, item }: HonorDuelItem, locale: AppLocale): string =>
  names[kind][item.name]?.[locale] || formatDisplayName(item.name)

/** Whether a search matches an item's name in any of the site's languages. */
export const matchesDuelItem = (item: HonorDuelItem, query: string): boolean => {
  const text = query.trim().toLowerCase()
  return (
    !text || APP_LOCALES.some((locale) => duelItemName(item, locale).toLowerCase().includes(text))
  )
}

/** An artifact's effect at a level, from 1. A level past the last the text
 * holds reads as the last. */
export const duelLevelText = (text: DuelArtifactText, level: number): string | undefined =>
  text.levels[Math.min(level, text.levels.length) - 1]

/** A tier of equipment as the game names it ("Rare Equipment"); Chinese joins
 * the two words without a space. */
export const equipmentTierLabel = (tier: EquipmentTier, locale: AppLocale): string =>
  [gameLabel(tier, locale), gameLabel('equipment', locale)].join(locale === 'zh' ? '' : ' ')

/** The item's picture, or undefined where the data pack holds none. */
export const duelItemImage = ({ kind, item }: HonorDuelItem): string | undefined =>
  images[kind][item.name]

const textChunks = {
  equipment: import.meta.glob<Record<string, DuelEquipmentText>>(
    '@/pack/text/hd/*/equipment.json',
    { import: 'default' },
  ),
  artifacts: import.meta.glob<Record<string, DuelArtifactText>>('@/pack/text/hd/*/artifacts.json', {
    import: 'default',
  }),
  creatures: import.meta.glob<Record<string, DuelCreatureText>>('@/pack/text/hd/*/creatures.json', {
    import: 'default',
  }),
}

const textPromises = new Map<SkillLocale, Promise<HonorDuelText>>()

/** One language's text, or null where the data pack holds none for it; the
 * creatures' file alone may be absent (DUEL_CREATURE_TEXT_IN_PACK), and their
 * list is then empty. Rejects only when the download fails, so a caller can
 * tell that from text the pack lacks. */
export function loadHonorDuelText(lang: SkillLocale): Promise<HonorDuelText | null> {
  const pending = textPromises.get(lang)
  if (pending) return pending
  const folder = `/src/pack/text/hd/${lang}`
  const equipment = textChunks.equipment[`${folder}/equipment.json`]
  const artifacts = textChunks.artifacts[`${folder}/artifacts.json`]
  const creatures = textChunks.creatures[`${folder}/creatures.json`]
  if (!equipment || !artifacts) return Promise.resolve(null)
  const promise = Promise.all([equipment(), artifacts(), creatures?.() ?? {}]).then(
    ([e, a, c]) => ({ equipment: e, artifacts: a, creatures: c }),
  )
  // A failed load is dropped so the next call asks again.
  promise.catch(() => textPromises.delete(lang))
  textPromises.set(lang, promise)
  return promise
}
