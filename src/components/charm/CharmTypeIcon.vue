<script setup lang="ts">
/* A charm type on the Seasonal tab: its symbol on a chip, with its bonuses in
   a hover card. A charm type cannot go on a board, so a click opens its
   details as a right-click or a hold does. */

import { ref } from 'vue'

import HoldRing from '@/components/ui/HoldRing.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInspect } from '@/composables/useInspect'
import { useLongPress } from '@/composables/useLongPress'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadCharmTypeImages } from '@/utils/imageLoader'

const { type } = defineProps<{
  type: string
  name: string
  bonus: readonly string[]
  // The language of the name and bonuses.
  lang: SkillLocale
}>()

const i18n = useI18nStore()
const symbol = loadCharmTypeImages()[type]

const { showTooltip, onMouseEnter, onMouseLeave } = useHoverTooltip()
const chip = ref<HTMLElement>()

const { inspect } = useInspect()
const open = (): void => {
  showTooltip.value = false
  void inspect({ kind: 'charm-type', type })
}
const { pressing, start: startHold, onContextMenu } = useLongPress<string>(open)
</script>

<template>
  <!-- The frame holds the hold ring outside the chip. -->
  <div class="charm-type-frame">
    <button
      ref="chip"
      type="button"
      class="charm-type inspectable"
      :aria-label="name"
      @click="open"
      @pointerdown="startHold($event, type)"
      @contextmenu="onContextMenu($event, type)"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <!-- The edges are shadows of the masked shape, so they sit on its parent:
           a filter on the masked element itself is cut off by the mask. -->
      <span v-if="symbol" class="symbol-edges">
        <span class="symbol" :style="{ maskImage: `url(${symbol})` }" />
      </span>
    </button>
    <HoldRing v-if="pressing" />

    <TooltipPopup v-if="showTooltip && chip" :target-element="chip">
      <template #content>
        <TooltipCard :name :hint="i18n.t('app.hold-for-skills')">
          <div class="bonus" :lang>
            <div v-for="line in bonus" :key="line">{{ line }}</div>
          </div>
        </TooltipCard>
      </template>
    </TooltipPopup>
  </div>
</template>

<style scoped>
.charm-type-frame {
  position: relative;
  width: fit-content;
  margin-top: var(--spacing-xs);
}

.charm-type {
  position: relative;
  display: block;
  width: 58px;
  height: 58px;
  padding: 0;
  border: 2px solid var(--color-bg-raised);
  border-radius: var(--radius-round);
  background: var(--color-bg-raised);
  cursor: pointer;
  transition: transform var(--transition-fast);
}

.charm-type:hover {
  transform: scale(1.05);
}

.symbol-edges {
  position: absolute;
  inset: 9%;
  filter: drop-shadow(0 -1px 0 rgba(0, 30, 28, 0.6)) drop-shadow(0 1px 0 rgba(255, 255, 255, 0.55));
}

.symbol {
  position: absolute;
  inset: 0;
  background: linear-gradient(#256f69, #3a9a92);
  mask: center / contain no-repeat;
}

.bonus {
  font-weight: 500;
  text-align: center;
}

@media (max-width: 480px) {
  .charm-type {
    width: var(--hero-icon-size);
    height: var(--hero-icon-size);
  }
}
</style>
