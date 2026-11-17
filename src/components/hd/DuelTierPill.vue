<script setup lang="ts">
/* A hero's tier in the hero card: the mark its portrait carries on the board,
   the tier's first character on the tier's backdrop. A tap moves to the next
   tier the hero can hold and wraps to the first. */

import { computed } from 'vue'

import { DUEL_TIERS, duelTiersOf } from '@/lib/hd/board'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'
import { isPaleTier, tierBackdrop } from '@/utils/tierBackdrop'

const { unitId, tier, readonly } = defineProps<{
  unitId: number
  // The tier's place in DUEL_TIERS.
  tier: number
  readonly?: boolean
}>()

const emit = defineEmits<{ pick: [tier: number] }>()

const i18n = useI18nStore()

const key = computed(() => DUEL_TIERS[tier] ?? DUEL_TIERS[0])
const label = computed(() => gameLabel(key.value, i18n.currentLocale))
const next = (): void => emit('pick', (tier + 1) % duelTiersOf(unitId).length)
</script>

<template>
  <component
    :is="readonly ? 'span' : 'button'"
    :type="readonly ? undefined : 'button'"
    class="duel-tier"
    :class="{ pale: isPaleTier(key), readonly }"
    :style="{ background: tierBackdrop(key) }"
    :title="label"
    :aria-label="label"
    @click="!readonly && next()"
  >
    {{ [...label][0] }}
  </component>
</template>

<style scoped>
.duel-tier {
  position: relative;
  z-index: 1;
  min-width: 26px;
  margin-top: -7px;
  padding: 2.5px 6px;
  border: none;
  border-radius: 999px;
  box-shadow:
    var(--upgrade-pill-rim),
    0 1px 3px rgba(0, 0, 0, 0.22);
  color: #fff;
  font: inherit;
  font-size: 9px;
  font-weight: 800;
  line-height: 1.25;
  text-align: center;
  cursor: pointer;
}

.duel-tier.pale {
  color: var(--duel-pale-ink);
}

.duel-tier.readonly {
  cursor: default;
}

@media (pointer: coarse) {
  .duel-tier:not(.readonly)::after {
    content: '';
    position: absolute;
    inset: -4px -6px -8px;
  }
}
</style>
