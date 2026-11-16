<script setup lang="ts">
/* The Honor Duel shop calculator: the shop in front of the player, the round,
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
import ShopOdds from '@/components/guide/shop/ShopOdds.vue'
import ShopProductPicker from '@/components/guide/shop/ShopProductPicker.vue'
import ShopWindow from '@/components/guide/shop/ShopWindow.vue'
import SlHead from '@/components/guide/sl/SlHead.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import type { ShopPickerStep } from '@/components/guide/shop/shopGoods'
import { useShopForm } from '@/components/guide/shop/useShopForm'
import { useShopEngine } from '@/composables/useShopEngine'
import { compareCharacters } from '@/lib/filterOrder'
import { duelEquipment } from '@/lib/hd/catalog'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { Move } from '@/lib/hd/shop/types'
import type { Point } from '@/lib/layout'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupShopContentMeta } from '@/utils/contentMeta'

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

// The heroes the shop sells this season.
const shopHeroes = computed(() => {
  const sold = new Set(SHOP_FACTS.heroes)
  return gameData.characters.filter((c) => sold.has(c.name)).sort(compareCharacters)
})
const drawn = computed(() => shopHeroes.value.filter((c) => !form.mythic.value.includes(c.name)))
const addable = computed(() =>
  drawn.value.filter((c) => !form.heroes.value.some((hero) => hero.name === c.name)),
)
const moreEquipment = computed(() =>
  duelEquipment.some((piece) => piece.shop && !form.equipment.value.includes(piece.name)),
)

type Popup =
  | { kind: 'card'; card: number; step: ShopPickerStep; position: Point }
  | { kind: 'hero' | 'equipment'; position: Point }
const popup = ref<Popup | null>(null)
const below = (under: DOMRect): Point => ({ x: under.left, y: under.bottom + 4 })

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

const answers = computed(() => {
  const result = engine.result.value
  return result && 'answers' in result ? result.answers : null
})
const impossible = computed(() => {
  const result = engine.result.value
  return !!result && 'error' in result
})

const answersEl = useTemplateRef<HTMLElement>('answers')
const calculate = (): void => {
  if (form.wanted.value) engine.calculate(form.request())
}
// Runs the calculation again from a recommended move. A reroll's locks are set
// on the shop itself; a purchase leaves the shop and the badges as entered, and
// the comparison starts from buying it first.
const recalculate = async (move: Move): Promise<void> => {
  if (move.kind === 'reroll') {
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
      :credit="i18n.t('app.shop-credit')"
      :about-label="i18n.t('app.shop-see-odds')"
      @about="oddsOpen = true"
    />
    <ShopOdds :show="oddsOpen" :level="form.level.value" @close="oddsOpen = false" />

    <div v-if="mounted" class="shop-layout">
      <ShopWindow
        :cards="form.cards.value"
        :level="form.level.value"
        @pick="
          (card, under) => (popup = { kind: 'card', card, step: 'product', position: below(under) })
        "
        @lock="form.toggleLock"
        @random="form.fillExample"
        @clear="form.clearCards"
      />
      <ShopForm
        v-model:round="form.round.value"
        :level="form.level.value"
        :rises="form.rises.value"
        :badges="form.badges.value"
        :heroes="form.heroes.value"
        :equipment="form.equipment.value"
        :more-heroes="addable.length > 0"
        :more-equipment
        :set="form.sell.value.length + form.mythic.value.length"
        :working="engine.working.value"
        :ready="form.wanted.value"
        @badges="form.setBadges"
        @copies="form.setCopies"
        @remove-hero="form.removeHero"
        @remove-equipment="form.removeEquipment"
        @add-hero="(under) => (popup = { kind: 'hero', position: below(under) })"
        @add-equipment="(under) => (popup = { kind: 'equipment', position: below(under) })"
        @more="listsOpen = true"
        @calculate="calculate"
        @cancel="engine.cancel"
      />
      <div ref="answers" class="shop-answers-slot">
        <p v-if="!form.wanted.value" class="shop-note">
          {{ i18n.t('app.shop-nothing-wanted') }}
        </p>
        <p v-else-if="impossible" class="shop-note warn">
          {{ i18n.t('app.shop-impossible', { level: form.level.value }) }}
        </p>
        <p v-else-if="engine.failed.value" class="shop-note warn">
          {{ i18n.t('app.shop-failed') }}
        </p>
        <ShopAnswers
          v-else-if="answers"
          :answers
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

    <Teleport to="body">
      <SelectionPopup
        v-if="popup"
        :key="popup.kind === 'card' ? popup.step : popup.kind"
        class="shop-picker-popup"
        :position="popup.position"
        keep-on-leave
        @close="popup = null"
      >
        <ShopProductPicker
          v-if="popup.kind === 'card'"
          :key="popup.card"
          v-model:step="popup.step"
          :card="form.cards.value[popup.card]!"
          :heroes="drawn"
          @set="(card) => popup?.kind === 'card' && form.setCard(popup.card, card)"
          @close="popup = null"
        />
        <div v-else-if="popup.kind === 'hero'" class="shop-popup">
          <CharacterSelectionPalette
            :characters="addable"
            :enter-hint="i18n.t('app.shop-add-hero')"
            @pick="(hero) => addHero(hero.name)"
          />
        </div>
        <div v-else class="shop-popup">
          <ShopEquipmentList :taken="form.equipment.value" @pick="addEquipment" />
        </div>
      </SelectionPopup>
    </Teleport>
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
