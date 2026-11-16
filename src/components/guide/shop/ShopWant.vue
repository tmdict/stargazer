<script setup lang="ts">
/* One hero or piece of equipment looked for, as a pill: its picture and name,
   for a hero the copies still wanted, and a button that takes it off. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconClose from '@/components/ui/IconClose.vue'
import IconMinus from '@/components/ui/IconMinus.vue'
import IconPlus from '@/components/ui/IconPlus.vue'
import { duelEquipment, duelItemImage } from '@/lib/hd/catalog'
import { SHOP_LIMITS } from '@/lib/hd/shop/calculate'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'
import { pieceName } from './shopGoods'

const { kind, name } = defineProps<{ kind: 'hero' | 'equipment'; name: string }>()

const emit = defineEmits<{ remove: [] }>()

// A hero's copies still wanted.
const copies = defineModel<number>('copies')

const i18n = useI18nStore()

const piece = computed(() => duelEquipment.find((one) => one.name === name))
const image = computed(() => piece.value && duelItemImage({ kind: 'equipment', item: piece.value }))
const label = computed(() =>
  kind === 'hero' ? curatedHeroName(name, i18n.currentLocale) : pieceName(name, i18n.currentLocale),
)

const step = (by: 1 | -1): void => {
  const next = (copies.value ?? 1) + by
  if (next >= 1 && next <= SHOP_LIMITS.copies) copies.value = next
}
</script>

<template>
  <span class="shop-want" :class="piece && `shop-tier-${piece.tier}`">
    <GuidePortrait v-if="kind === 'hero'" :slug="name" :lang="i18n.currentLocale" :size="40" />
    <span v-else class="icon"><img v-if="image" :src="image" alt="" draggable="false" /></span>
    <span class="label">{{ label }}</span>
    <span v-if="copies !== undefined" class="copies" role="group">
      <button
        type="button"
        :aria-label="i18n.t('app.shop-copies-lower')"
        :aria-disabled="copies <= 1"
        @click="step(-1)"
      >
        <IconMinus />
      </button>
      <span aria-live="polite">×{{ copies }}</span>
      <button
        type="button"
        :aria-label="i18n.t('app.shop-copies-raise')"
        :aria-disabled="copies >= SHOP_LIMITS.copies"
        @click="step(1)"
      >
        <IconPlus />
      </button>
    </span>
    <button
      type="button"
      class="remove"
      :aria-label="i18n.t('app.shop-remove', { item: label })"
      :title="i18n.t('app.shop-remove', { item: label })"
      @click="emit('remove')"
    >
      <IconClose :size="14" />
    </button>
  </span>
</template>

<style scoped>
.shop-want {
  --disc-ring: rgba(255, 255, 255, 0.5);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 5px 8px 5px 6px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  color: var(--import-text);
  font-weight: 600;
}

.icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px var(--shop-tier);
}

.icon img {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.copies {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-variant-numeric: tabular-nums;
}

button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--import-text-dim);
  font: inherit;
  font-size: 15px;
  cursor: pointer;
}

button:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--import-text);
}

button[aria-disabled='true'] {
  opacity: 0.35;
  cursor: default;
}

button[aria-disabled='true']:hover {
  background: none;
}
</style>
