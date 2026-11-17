/* The equipment and artifacts an Honor Duel board holds, by the ids it holds
 * them under, as the board and its hero card draw them. The catalog behind
 * them is fetched the first time an item is asked for, so the Arena page loads
 * none of it for a visitor who never opens an Honor Duel board. */

import { shallowRef } from 'vue'

import type { HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { tierBackdrop } from '@/utils/tierBackdrop'

type DuelCatalog = typeof import('@/lib/hd/catalog')

const catalog = shallowRef<DuelCatalog | null>(null)
let requested = false

const loaded = (): DuelCatalog | null => {
  if (!requested && !import.meta.env.SSR) {
    requested = true
    void import('@/lib/hd/catalog').then((module) => {
      catalog.value = module
    })
  }
  return catalog.value
}

export interface DuelItemView {
  item: HonorDuelItem
  label: string
  image: string | undefined
  // A piece's tier backdrop; an artifact has none.
  backdrop: string | undefined
}

export function useDuelItems() {
  const i18n = useI18nStore()

  const view = (source: DuelCatalog, item: HonorDuelItem): DuelItemView => ({
    item,
    label: source.duelItemName(item, i18n.currentLocale),
    image: source.duelItemImage(item),
    backdrop: item.kind === 'equipment' ? tierBackdrop(item.item.tier) : undefined,
  })

  // Null for no item (0), for an id that names none, and until the catalog
  // arrives.
  const pieceOf = (id: number): DuelItemView | null => {
    const source = id === 0 ? null : loaded()
    const item = source?.duelEquipmentById(id)
    return source && item ? view(source, { kind: 'equipment', item }) : null
  }

  const artifactOf = (id: number): DuelItemView | null => {
    const source = id === 0 ? null : loaded()
    const item = source?.duelArtifactById(id)
    return source && item ? view(source, { kind: 'artifact', item }) : null
  }

  return { pieceOf, artifactOf }
}
