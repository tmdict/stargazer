<script setup lang="ts">
/* A hero's tier by name on the tier's backdrop, a Trial chip for a Trial hero
   and the name of its equipment: the words behind the marks its portrait
   carries on the board. */

import type { DuelTier } from '@/lib/hd/board'
import { useI18nStore } from '@/stores/i18n'
import { gameLabel } from '@/utils/skillLabels'
import { isPaleTier, tierBackdrop } from '@/utils/tierBackdrop'

defineProps<{
  tier: DuelTier
  trial: boolean
  piece?: string
}>()

const i18n = useI18nStore()
</script>

<template>
  <div class="duel-chips">
    <span
      class="duel-chip"
      :class="{ pale: isPaleTier(tier) }"
      :style="{ background: tierBackdrop(tier) }"
    >
      {{ gameLabel(tier, i18n.currentLocale) }}
    </span>
    <span v-if="trial" class="duel-chip trial">{{ i18n.t('app.trial') }}</span>
    <span v-if="piece" class="duel-piece">{{ piece }}</span>
  </div>
</template>

<style scoped>
.duel-chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 10px;
}

.duel-chip {
  padding: 2px 9px;
  border-radius: 999px;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
}

.duel-chip.pale {
  color: var(--duel-pale-ink);
}

.duel-chip.trial {
  background: var(--duel-trial-mark);
}

.duel-piece {
  flex-basis: 100%;
  text-align: center;
}
</style>
