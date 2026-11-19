<script setup lang="ts">
/* A unit's tier: the tier's first character on the backdrop that fills its
   portrait on the board. A tap moves to the next tier the unit can hold and
   wraps to the first. A unit with one tier shows it without a choice. The host
   may widen the click area past what is drawn (--hit-reach). */

import { computed } from 'vue'

import { DUEL_TIERS } from '@/lib/hd/board'
import { duelTiersOf, hasDuelTierChoice } from '@/lib/hd/units'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { initialOf } from '@/utils/nameFormatting'
import { gameLabel } from '@/utils/skillLabels'
import { isPaleTier, tierBackdrop } from '@/utils/tierBackdrop'

const { unitId, tier, readonly, lang } = defineProps<{
  unitId: number
  // The tier's place in DUEL_TIERS.
  tier: number
  readonly?: boolean
  // A picture of the pill names its tier in the picture's language.
  lang?: AppLocale
}>()

const emit = defineEmits<{ pick: [tier: number] }>()

const i18n = useI18nStore()

const key = computed(() => DUEL_TIERS[tier] ?? DUEL_TIERS[0])
const label = computed(() => gameLabel(key.value, lang ?? i18n.currentLocale))
const choices = computed(() => duelTiersOf(unitId))
const fixed = computed(() => readonly || !hasDuelTierChoice(unitId))
const next = (): void => {
  const tiers = choices.value
  emit('pick', tiers[(tiers.indexOf(tier) + 1) % tiers.length]!)
}
</script>

<template>
  <component
    :is="fixed ? 'span' : 'button'"
    :type="fixed ? undefined : 'button'"
    class="duel-tier"
    :class="{ pale: isPaleTier(key), readonly: fixed }"
    :style="{ background: tierBackdrop(key) }"
    :title="label"
    :aria-label="label"
    @click="!fixed && next()"
  >
    {{ initialOf(label) }}
  </component>
</template>

<style scoped>
.duel-tier {
  position: relative;
  z-index: 1;
  min-width: 26px;
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

.duel-tier:not(.readonly)::after {
  content: '';
  position: absolute;
  inset: calc(var(--hit-reach, 0px) * -1);
}

@media (pointer: coarse) {
  .duel-tier:not(.readonly)::after {
    inset: -4px -6px -8px;
  }
}
</style>
