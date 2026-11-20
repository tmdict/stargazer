<script setup lang="ts">
/* The calculator's form beside the shop window: the shop level, whether it
   goes up next round, the badges in hand, the heroes and equipment looked for,
   the link to the heroes to sell and the Mythic heroes, and Calculate. While a
   calculation runs, Calculate gives way to Cancel. It waits for something to
   look for, which a line under it asks for, and for cards the level can show.
   Whether the level goes up is
   the player's to say only where the game leaves it open: a level that lasts
   one round always does, and the last level never does. */

import { computed, nextTick } from 'vue'

import ShopBadges from './ShopBadges.vue'
import ShopWant from './ShopWant.vue'
import IconPlus from '@/components/ui/IconPlus.vue'
import { SHOP_LIMITS, type WantedHero } from '@/lib/hd/shop/calculate'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import { risesNext } from '@/lib/hd/shop/odds'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'

const props = defineProps<{
  badges: number
  heroes: readonly WantedHero[]
  equipment: readonly string[]
  // Whether a hero or a piece can still be added: one is left to add, and the
  // list is not full.
  moreHeroes: boolean
  moreEquipment: boolean
  // How many heroes are set to be sold or left out.
  set: number
  working: boolean
  // Whether the shop window's cards can come up at its level.
  possible: boolean
}>()

const emit = defineEmits<{
  badges: [value: number]
  copies: [hero: string, copies: number]
  removeHero: [hero: string]
  removeEquipment: [piece: string]
  addHero: [under: DOMRect]
  addEquipment: [under: DOMRect]
  more: []
  calculate: []
  cancel: []
}>()

const level = defineModel<number>('level', { required: true })
// Whether the shop level goes up next round.
const rises = defineModel<boolean>('rises', { required: true })

const i18n = useI18nStore()

const wanted = computed(() => props.heroes.length > 0 || props.equipment.length > 0)

const levels = SHOP_FACTS.levelRounds.map((_, index) => index + 1)

// Whether the player's word changes anything at this level.
const open = computed(
  () =>
    risesNext(level.value, true, SHOP_FACTS.levelRounds) &&
    !risesNext(level.value, false, SHOP_FACTS.levelRounds),
)

// The box is written back after the page has taken the number, so a number
// out of range shows as the one kept.
const enterBadges = async (event: Event): Promise<void> => {
  const box = event.target as HTMLInputElement
  emit('badges', box.valueAsNumber)
  await nextTick()
  box.value = String(props.badges)
}

const under = (event: MouseEvent): DOMRect =>
  (event.currentTarget as HTMLElement).getBoundingClientRect()
</script>

<template>
  <section class="sl-panel shop-box shop-form">
    <div class="top">
      <div class="levels" role="group" :aria-label="i18n.t('app.shop-level-label')">
        <span class="shop-label">{{ i18n.t('app.shop-level-label') }}</span>
        <span class="list">
          <button
            v-for="one in levels"
            :key="one"
            type="button"
            class="choice"
            :aria-pressed="one === level"
            @click="level = one"
          >
            {{ one }}
          </button>
        </span>
        <button
          type="button"
          class="choice rises"
          :aria-pressed="rises"
          :disabled="!open"
          @click="rises = !rises"
        >
          {{ i18n.t('app.shop-rises') }}
        </button>
      </div>
      <label class="set">
        <span class="shop-label">{{ i18n.t('app.shop-badges') }}</span>
        <span class="field">
          <ShopBadges count="" />
          <input
            type="number"
            inputmode="numeric"
            min="0"
            :max="SHOP_LIMITS.badges"
            :value="badges"
            @change="enterBadges"
          />
        </span>
      </label>
    </div>

    <h2 class="shop-heading">
      {{ i18n.t('app.shop-looking-for') }}
      <span class="shop-dim">
        {{ i18n.t('app.shop-wanted-hint', { count: SHOP_LIMITS.wanted }) }}
      </span>
    </h2>
    <p class="shop-label">
      {{ i18n.t('app.heroes') }}
      <span class="shop-dim">
        {{ i18n.t('app.shop-copies-hint', { copies: SHOP_LIMITS.copies }) }}
      </span>
    </p>
    <div class="wants">
      <ShopWant
        v-for="hero in heroes"
        :key="hero.name"
        kind="hero"
        :name="hero.name"
        :copies="hero.copies"
        @update:copies="(copies) => copies && emit('copies', hero.name, copies)"
        @remove="emit('removeHero', hero.name)"
      />
      <button v-if="moreHeroes" type="button" class="add" @click="emit('addHero', under($event))">
        <IconPlus /> {{ i18n.t('app.shop-add-hero') }}
      </button>
    </div>
    <p class="shop-label">{{ gameLabel('equipment', i18n.currentLocale) }}</p>
    <div class="wants">
      <ShopWant
        v-for="piece in equipment"
        :key="piece"
        kind="equipment"
        :name="piece"
        @remove="emit('removeEquipment', piece)"
      />
      <button
        v-if="moreEquipment"
        type="button"
        class="add"
        @click="emit('addEquipment', under($event))"
      >
        <IconPlus /> {{ i18n.t('app.shop-add-equipment') }}
      </button>
    </div>

    <p v-if="rises" class="notice">
      {{ i18n.t('app.shop-level-notice', { level: level + 1 }) }}
    </p>
    <div class="foot">
      <button type="button" class="more" @click="emit('more')">
        {{ i18n.t('app.shop-more') }}<template v-if="set"> ({{ set }})</template>
      </button>
      <span class="actions">
        <button
          v-if="working"
          type="button"
          class="solid-btn sl-action outline"
          @click="emit('cancel')"
        >
          {{ i18n.t('app.cancel') }}
        </button>
        <button
          type="button"
          class="solid-btn sl-action"
          :disabled="!wanted || !possible || working"
          :aria-busy="working"
          @click="emit('calculate')"
        >
          {{ i18n.t(working ? 'app.shop-calculating' : 'app.shop-calculate') }}
        </button>
      </span>
      <p v-if="!wanted" class="shop-note wait">{{ i18n.t('app.shop-need-wanted') }}</p>
    </div>
  </section>
</template>

<style scoped>
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px 22px;
}

.levels {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.list {
  display: inline-flex;
  gap: 4px;
}

.choice {
  position: relative;
  min-width: 34px;
  height: 32px;
  padding: 0 8px;
  border: var(--field-dark-border);
  border-radius: var(--field-dark-radius);
  background: rgba(0, 0, 0, 0.25);
  color: var(--import-text);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.choice:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.4);
}

.choice:disabled {
  cursor: default;
  opacity: 0.6;
}

.choice[aria-pressed='true'] {
  border-color: var(--color-header-gold);
  background: var(--import-warn-tint);
  color: var(--color-header-gold);
}

.rises {
  padding: 0 12px;
}

.notice {
  margin: auto 0 0;
  padding: 8px 12px;
  border: 1px solid var(--color-header-gold);
  border-radius: var(--radius-medium);
  background: var(--import-warn-tint);
  color: var(--color-header-gold);
  font-size: 13px;
  font-weight: 600;
}

.notice + .foot {
  margin-top: 0;
}

.set {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.field {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border: var(--field-dark-border);
  border-radius: var(--field-dark-radius);
  background: rgba(0, 0, 0, 0.25);
}

.field:focus-within {
  border-color: rgba(255, 255, 255, 0.4);
}

.field input {
  width: 3.6em;
  padding: 0;
  border: 0;
  background: none;
  color: #fff;
  font: inherit;
  font-size: max(13px, var(--field-min-font-size));
  font-weight: 600;
  appearance: textfield;
  -moz-appearance: textfield;
}

.field input:focus {
  outline: none;
}

.field input::-webkit-inner-spin-button,
.field input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.wants {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 52px;
  padding: 5px 20px;
  border: 1px dashed var(--import-border-strong);
  border-radius: 999px;
  background: none;
  color: var(--import-text-dim);
  font: inherit;
  cursor: pointer;
}

.add:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
}

.more {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font: inherit;
  font-size: 13px;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
  cursor: pointer;
}

.actions {
  display: inline-flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}

.wait {
  flex-basis: 100%;
  text-align: right;
}

@media (max-width: 520px) {
  .actions {
    width: 100%;
  }

  .wait {
    text-align: center;
  }

  .actions .solid-btn {
    flex: 1;
    justify-content: center;
  }
}
</style>
