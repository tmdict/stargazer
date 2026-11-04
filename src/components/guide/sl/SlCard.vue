<script setup lang="ts">
/* A card on a generator page or a board's Placement tips: a title, then
   lines, bulleted unless plain, or a sentence. Names show in the colour that
   rings the units a card names on its board, and in a line on better tiles,
   the word for them in their colour. */

import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { TextPart } from '@/utils/interpolate'

defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  clearOf?: Pick<Element, 'getBoundingClientRect'>
  offset?: number
  title?: TextPart[]
  lines?: { lead?: string; parts: TextPart[]; better?: boolean }[]
  // Lines without bullets, for a card of a sentence or two.
  plain?: boolean
  text?: string
  // The board it explains follows the page's light or dark look, where the
  // generator's boards are dark in both; the card is teleported, so it cannot
  // read that from the board.
  pageLook?: boolean
}>()
</script>

<template>
  <Teleport to="body">
    <TooltipPopup
      :target-element="anchor"
      :clear-of
      :offset
      variant="detailed"
      :class="{ 'page-look': pageLook }"
    >
      <template #content>
        <TooltipCard>
          <template #default>
            <div v-if="title" class="sl-card-title">
              <span v-for="(part, i) in title" :key="i" :class="{ 'sl-card-name': part.marked }">{{
                part.text
              }}</span>
            </div>
            <div v-if="text">{{ text }}</div>
            <ul v-if="lines?.length" class="sl-card-lines" :class="{ plain }">
              <li v-for="(line, index) in lines" :key="index" :class="{ better: line.better }">
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
.sl-card-title {
  font-weight: 600;
}

.sl-card-title:not(:last-child) {
  margin-bottom: 6px;
}

.sl-card-lines {
  margin: 0;
  padding-left: 16px;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.sl-card-lines.plain {
  padding-left: 0;
  list-style: none;
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

.page-look .sl-card-name {
  color: var(--placement-name);
}

.better .sl-card-name {
  color: var(--placement-better);
}
</style>
