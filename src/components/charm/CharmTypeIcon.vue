<script setup lang="ts">
/* A charm type on the Seasonal tab: its symbol on a chip, with its bonuses in
   a hover card. */

import { computed, ref } from 'vue'

import HoldRing from '@/components/ui/HoldRing.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInspectOnClick } from '@/composables/useInspectOnClick'
import { useI18nStore } from '@/stores/i18n'
import { loadCharmTypeImages } from '@/utils/imageLoader'

const { type, bonus } = defineProps<{
  type: string
  name: string
  bonus: readonly string[]
}>()

const i18n = useI18nStore()
const symbol = loadCharmTypeImages()[type]

// A bonus line is a stat and its amount: "Skill Power +4".
const rows = computed(() =>
  bonus.map((line) => {
    const cut = line.lastIndexOf(' ')
    return cut < 0
      ? { label: line, value: '' }
      : { label: line.slice(0, cut), value: line.slice(cut + 1) }
  }),
)

const chip = ref<HTMLElement>()
const { showTooltip, onMouseEnter, onMouseLeave, open, pressing, onPointerDown, onContextMenu } =
  useInspectOnClick(() => ({ kind: 'charm-type', type }))
</script>

<template>
  <div class="icon-disc-frame">
    <button
      ref="chip"
      type="button"
      class="charm-type icon-disc inspectable"
      :aria-label="name"
      @click="open"
      @pointerdown="onPointerDown"
      @contextmenu="onContextMenu"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <span v-if="symbol" class="symbol" :style="{ maskImage: `url(${symbol})` }" />
    </button>
    <HoldRing v-if="pressing" />

    <TooltipPopup v-if="showTooltip && chip" :target-element="chip">
      <template #content>
        <TooltipCard :name :rows :hint="i18n.t('app.hold-for-details')" />
      </template>
    </TooltipPopup>
  </div>
</template>

<style scoped>
.charm-type {
  position: relative;
  display: block;
  width: 46px;
  height: 46px;
  padding: 0;
  background: var(--color-bg-secondary);
}

.symbol {
  position: absolute;
  inset: 9%;
  background: var(--color-primary);
  mask: center / contain no-repeat;
}
</style>
