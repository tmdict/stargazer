// Honor Duel's equipment and artifacts: the data files, display names and
// pictures, and the data pack's text, one lazy chunk per language. Only the
// Honor Duel tab and its popup import this module, so none of it loads until
// the tab is opened.

import type {
  DuelArtifact,
  DuelArtifactText,
  DuelEquipment,
  DuelEquipmentText,
  EquipmentTier,
  HonorDuelItem,
  HonorDuelText,
} from '@/lib/types/honorDuel'
import type { AppLocale, LocaleData, SkillLocale } from '@/lib/types/i18n'
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
}

const textPromises = new Map<SkillLocale, Promise<HonorDuelText>>()

/** One language's text. Rejects where the data pack holds none for it. */
export function loadHonorDuelText(lang: SkillLocale): Promise<HonorDuelText> {
  const pending = textPromises.get(lang)
  if (pending) return pending
  const folder = `/src/pack/text/hd/${lang}`
  const equipment = textChunks.equipment[`${folder}/equipment.json`]
  const artifacts = textChunks.artifacts[`${folder}/artifacts.json`]
  if (!equipment || !artifacts) {
    return Promise.reject(new Error(`No Honor Duel text for "${lang}"`))
  }
  const promise = Promise.all([equipment(), artifacts()]).then(([e, a]) => ({
    equipment: e,
    artifacts: a,
  }))
  // A failed load is dropped so the next call asks again.
  promise.catch(() => textPromises.delete(lang))
  textPromises.set(lang, promise)
  return promise
}
