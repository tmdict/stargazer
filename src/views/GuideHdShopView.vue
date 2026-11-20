<script setup lang="ts">
/* The Honor Duel shop calculator: the shop in front of the player, its level,
   the badges in hand and what they are looking for, and for each target the
   move with the best chance this round and the move that costs the fewest
   badges on average (lib/hd/shop), worked out in the shop worker
   (useShopEngine) so the page stays responsive. The answers come in stages
   and are shown as they stand. Any edit of the form drops them and ends the
   calculation at work, so what is shown always belongs to what was entered.
   Nothing is kept between visits.
   The page is pre-rendered with its heading alone: the form is drawn after
   mount. */

import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import ShopAnswers from '@/components/guide/shop/ShopAnswers.vue'
import ShopEquipmentList from '@/components/guide/shop/ShopEquipmentList.vue'
import ShopForm from '@/components/guide/shop/ShopForm.vue'
import ShopHeroLists from '@/components/guide/shop/ShopHeroLists.vue'
import ShopLockedAt from '@/components/guide/shop/ShopLockedAt.vue'
import ShopOdds from '@/components/guide/shop/ShopOdds.vue'
import ShopPickerPopup from '@/components/guide/shop/ShopPickerPopup.vue'
import ShopPopupClose from '@/components/guide/shop/ShopPopupClose.vue'
import ShopProductPicker from '@/components/guide/shop/ShopProductPicker.vue'
import ShopWindow from '@/components/guide/shop/ShopWindow.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import { lockedLevel, lockLevels, type ShopPickerStep } from '@/components/guide/shop/shopGoods'
import { useShopForm } from '@/components/guide/shop/useShopForm'
import { useShopEngine } from '@/composables/useShopEngine'
import { HD_SHOP_PROBABILITY_PATH } from '@/lib/guide'
import { duelHeroes } from '@/lib/hd/heroes'
import type { Move } from '@/lib/hd/shop/types'
import type { Point } from '@/lib/layout'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupShopContentMeta } from '@/utils/contentMeta'
import { duelEquipment } from '@/utils/duelCatalog'
import { below } from '@/utils/popupLayout'

import '@/components/guide/sl/sl.css'
import '@/components/guide/shop/shop.css'

const i18n = useI18nStore()
setupShopContentMeta(computed(() => i18n.currentLocale))

const gameData = useGameDataStore()
gameData.initializeContentData()

const engine = useShopEngine()
// The move the answers on screen start from, when the player chose one.
const basis = ref<Move | null>(null)
const form = useShopForm(() => {
  basis.value = null
  engine.clear()
})

const mounted = ref(false)
onMounted(() => (mounted.value = true))

const shopHeroes = computed(() => duelHeroes(gameData.characters))
const drawn = computed(() => shopHeroes.value.filter((c) => !form.mythic.value.includes(c.name)))
const addable = computed(() =>
  drawn.value.filter((c) => !form.heroes.value.some((hero) => hero.name === c.name)),
)
const moreEquipment = computed(() =>
  duelEquipment.some((piece) => piece.shop && !form.equipment.value.includes(piece.name)),
)

type Popup =
  | { kind: 'card'; card: number; step: ShopPickerStep; position: Point }
  | { kind: 'locked-at'; card: number; position: Point }
  | { kind: 'hero' | 'equipment'; position: Point }
const popup = ref<Popup | null>(null)

const POPUP_LABELS: Record<Popup['kind'], string> = {
  card: 'app.shop-pick-card',
  'locked-at': 'app.shop-locked-at-title',
  hero: 'app.shop-add-hero',
  equipment: 'app.shop-add-equipment',
}
// One popup per card and step: a press on another card's opener reaches the
// popup still open as a press outside it, and must close that one alone.
const popupKey = computed(() => {
  const open = popup.value
  if (!open) return ''
  return [open.kind, 'card' in open ? open.card : '', open.kind === 'card' ? open.step : ''].join()
})

// The card whose locked-at level the open popup sets.
const lockCard = computed(() =>
  popup.value?.kind === 'locked-at' ? form.cards.value[popup.value.card] : undefined,
)
const setLockedAt = (level: number): void => {
  if (popup.value?.kind === 'locked-at') form.setLockedAt(popup.value.card, level)
  popup.value = null
}

const addHero = (name: string): void => {
  form.addHero(name)
  popup.value = null
}
const addEquipment = (name: string): void => {
  form.addEquipment(name)
  popup.value = null
}

const oddsOpen = ref(false)
const listsOpen = ref(false)

const answersEl = useTemplateRef<HTMLElement>('answers')
const calculate = (): void => {
  if (!form.ready.value) return
  basis.value = null
  engine.calculate(form.request())
}
// Runs the calculation again from a recommended move. A reroll's locks are set
// on the shop itself; a purchase leaves the shop and the badges as entered, and
// the comparison starts from buying it first. So does a reroll that lets go of
// a card kept from a lower level: the shop cannot be read with that card
// unlocked.
const recalculate = async (move: Move): Promise<void> => {
  const level = form.level.value
  const releasesKept =
    move.kind === 'reroll' &&
    form.cards.value.some(
      (card, index) =>
        card.locked && !move.locks.includes(index) && lockedLevel(card, level) < level,
    )
  if (move.kind === 'reroll' && !releasesKept) {
    form.setLocks(move.locks)
    // The form's watcher clears the answers on the next tick.
    await nextTick()
    basis.value = null
    calculate()
    return
  }
  basis.value = move
  engine.calculate({ ...form.request(), startFrom: move })
}
// The first answers of a press are brought into view; the later stages only
// narrow figures already on screen.
watch(
  () => engine.result.value !== null,
  async (shown) => {
    if (!shown) return
    await nextTick()
    answersEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  },
)
</script>

<template>
  <main class="sl-page shop-page" data-theme="dark">
    <SlHead
      :title="i18n.t('app.shop-title')"
      :about-label="i18n.t('app.shop-see-odds')"
      :guide="{ to: HD_SHOP_PROBABILITY_PATH, label: i18n.t('app.shop-probability-link') }"
      @about="oddsOpen = true"
    />
    <ShopOdds :show="oddsOpen" :level="form.level.value" @close="oddsOpen = false" />

    <div v-if="mounted" class="shop-layout">
      <ShopWindow
        :cards="form.cards.value"
        :level="form.level.value"
        :problems="form.problems.value"
        @pick="
          (card, under) => (popup = { kind: 'card', card, step: 'product', position: below(under) })
        "
        @lock="form.toggleLock"
        @locked-at="(card, under) => (popup = { kind: 'locked-at', card, position: below(under) })"
        @random="form.fillExample"
        @clear="form.clearCards"
      />
      <ShopForm
        v-model:level="form.level.value"
        v-model:rises="form.rises.value"
        :badges="form.badges.value"
        :heroes="form.heroes.value"
        :equipment="form.equipment.value"
        :more-heroes="!form.full.value && addable.length > 0"
        :more-equipment="!form.full.value && moreEquipment"
        :sell="form.sell.value.length"
        :mythic="form.mythic.value.length"
        :working="engine.working.value"
        :possible="form.problems.value.length === 0"
        @badges="form.setBadges"
        @copies="form.setCopies"
        @remove-hero="form.removeHero"
        @remove-equipment="form.removeEquipment"
        @add-hero="(under) => (popup = { kind: 'hero', position: below(under) })"
        @add-equipment="(under) => (popup = { kind: 'equipment', position: below(under) })"
        @lists="listsOpen = true"
        @calculate="calculate"
        @cancel="engine.cancel"
      />
      <div ref="answers" class="shop-answers-slot">
        <p v-if="engine.failed.value" class="shop-note warn">
          {{ i18n.t('app.shop-failed') }}
        </p>
        <ShopAnswers
          v-else-if="engine.result.value"
          :answers="engine.result.value.answers"
          :skipped="engine.result.value.skipped"
          :cards="form.cards.value"
          :basis
          :heroes="form.heroes.value"
          :level="form.level.value"
          :badges="form.badges.value"
          :working="engine.working.value"
          @recalculate="recalculate"
        />
      </div>
    </div>

    <ShopHeroLists
      :show="listsOpen"
      :heroes="shopHeroes"
      :sell="form.sell.value"
      :mythic="form.mythic.value"
      @sell="form.toggleSell"
      @mythic="form.toggleMythic"
      @close="listsOpen = false"
    />

    <ShopPickerPopup
      v-if="popup"
      :key="popupKey"
      :label="i18n.t(POPUP_LABELS[popup.kind])"
      :position="popup.position"
      @close="popup = null"
    >
      <ShopProductPicker
        v-if="popup.kind === 'card'"
        v-model:step="popup.step"
        :card="form.cards.value[popup.card]!"
        :heroes="drawn"
        @set="(card) => popup?.kind === 'card' && form.setCard(popup.card, card)"
        @close="popup = null"
      />
      <ShopLockedAt
        v-else-if="popup.kind === 'locked-at' && lockCard"
        :levels="lockLevels(lockCard, form.level.value)"
        :level="lockedLevel(lockCard, form.level.value)"
        @pick="setLockedAt"
        @close="popup = null"
      />
      <div v-else-if="popup.kind === 'hero'" class="shop-popup">
        <ShopPopupClose @close="popup = null" />
        <CharacterSelectionPalette
          :characters="addable"
          :enter-hint="i18n.t('app.shop-add-hero')"
          @pick="(hero) => addHero(hero.name)"
        />
      </div>
      <div v-else class="shop-popup">
        <ShopPopupClose @close="popup = null" />
        <ShopEquipmentList :taken="form.equipment.value" @pick="addEquipment" />
      </div>
    </ShopPickerPopup>
  </main>
</template>

<style scoped>
.shop-answers-slot {
  scroll-margin-top: var(--spacing-lg);
}

.shop-answers-slot:empty {
  display: none;
}
</style>
