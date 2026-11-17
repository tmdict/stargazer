/* The equipment an Honor Duel board holds, by the ids it holds it under, as
 * the board and its hero card draw it. The catalog behind it is fetched the
 * first time a piece is asked for, so the Arena page loads none of it for a
 * visitor who never opens an Honor Duel board. */

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
    // A download that failed is asked for again by the next piece drawn.
    import('@/lib/hd/catalog').then(
      (module) => {
        catalog.value = module
      },
      () => {
        requested = false
      },
    )
  }
  return catalog.value
}

export interface DuelItemView {
  item: HonorDuelItem
  label: string
  image: string | undefined
  backdrop: string | undefined
}

export function useDuelItems() {
  const i18n = useI18nStore()

  // Null for no piece (0), for an id that names none, and until the catalog
  // arrives.
  const pieceOf = (id: number): DuelItemView | null => {
    const source = id === 0 ? null : loaded()
    const piece = source?.duelEquipmentById(id)
    if (!source || !piece) return null
    const item: HonorDuelItem = { kind: 'equipment', item: piece }
    return {
      item,
      label: source.duelItemName(item, i18n.currentLocale),
      image: source.duelItemImage(item),
      backdrop: tierBackdrop(piece.tier),
    }
  }

  return { pieceOf }
}
