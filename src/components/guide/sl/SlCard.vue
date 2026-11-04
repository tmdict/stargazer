<script setup lang="ts">
/* A card on a generator page: a title, bullet lines or a plain sentence. Names
   show in the amber that rings the units a card names on the board. */

import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { TextPart } from '@/utils/interpolate'

defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  clearOf?: Pick<Element, 'getBoundingClientRect'>
  offset?: number
  title?: TextPart[]
  lines?: { lead?: string; parts: TextPart[] }[]
  text?: string
}>()
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="anchor" :clear-of :offset variant="detailed">
      <template #content>
        <TooltipCard>
          <template #default>
            <div v-if="title" class="sl-card-title">
              <span v-for="(part, i) in title" :key="i" :class="{ 'sl-card-name': part.marked }">{{
                part.text
              }}</span>
            </div>
            <div v-if="text">{{ text }}</div>
            <ul v-if="lines?.length" class="sl-card-lines">
              <li v-for="(line, index) in lines" :key="index">
                <template v-if="line.lead"
                  ><b>{{ line.lead }}</b
                  >{{ ' ' }}</template
                ><span
                  v-for="(part, i) in line.parts"
                  :key="i"
                  :class="{ 'sl-card-name': part.marked }"
                  >{{ part.text }}</span
                >
              </li>
            </ul>
          </template>
        </TooltipCard>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.sl-card-title:not(:last-child) {
  margin-bottom: 6px;
  font-weight: 600;
}

.sl-card-lines {
  margin: 0;
  padding-left: 16px;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.sl-card-lines li {
  margin: 0;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  opacity: 1;
}

.sl-card-lines li + li {
  margin-top: 5px;
}

.sl-card-lines li::marker {
  color: var(--tooltip-muted);
}

.sl-card-lines b {
  font-weight: 600;
}

.sl-card-name {
  color: var(--color-warning);
}
</style>
