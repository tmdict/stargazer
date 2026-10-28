<script setup lang="ts">
/* The Supreme League pages' BETA chip with its note. Inside a link (the
   guide index's card) it is a span with the note on hover alone, since a
   button can't sit in a link and a tap there opens the page. */

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { useI18nStore } from '@/stores/i18n'

const { inLink = false } = defineProps<{ inLink?: boolean }>()

const i18n = useI18nStore()

const { anchor, hoverOpen, hoverClose, toggle, onTouchStart } = useInfoTip()
</script>

<template>
  <span v-if="inLink" class="sl-beta" @mouseenter="hoverOpen" @mouseleave="hoverClose">BETA</span>
  <button
    v-else
    type="button"
    class="sl-beta"
    @mouseenter="hoverOpen"
    @mouseleave="hoverClose"
    @focus="hoverOpen"
    @blur="hoverClose"
    @click="toggle"
    @touchstart.passive="onTouchStart"
  >
    BETA
  </button>
  <Teleport v-if="anchor" to="body">
    <TooltipPopup :target-element="anchor" variant="detailed" max-width="290px">
      <template #content>{{ i18n.t('app.sl-beta-tip') }}</template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.sl-beta {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin-left: 8px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--color-warning) 55%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  vertical-align: top;
}

span.sl-beta {
  position: relative;
  z-index: 2;
}

button.sl-beta {
  cursor: help;
}
</style>
