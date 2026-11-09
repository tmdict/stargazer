<script setup lang="ts">
/* A buff's sentence, its numbers and keywords in the skill text's styles. A
   keyword gets no glossary pop-up, since the card holding it already is one. */

import { computed } from 'vue'

import { useI18nStore } from '@/stores/i18n'
import { HIGHLIGHT_RE, splitHighlightToken } from '@/utils/textHighlight'

const { buff, heading = false } = defineProps<{
  buff: string
  // Titles the buff inside another card, such as a unit's.
  heading?: boolean
}>()

const i18n = useI18nStore()

// Splitting on the token pattern leaves each token's inside at an odd index.
const segments = computed(() =>
  i18n
    .t(`buff.${buff}`)
    .split(HIGHLIGHT_RE)
    .map((text, i) => (i % 2 ? { token: true, ...splitHighlightToken(text) } : { label: text })),
)
</script>

<template>
  <div :class="{ 'buff-tile-part': heading }">
    <div v-if="heading" class="buff-tile-heading">{{ i18n.t('app.buff-tile') }}</div>
    <div>
      <template v-for="(segment, i) in segments" :key="i">
        <span
          v-if="'token' in segment"
          :class="segment.key ? 'skill-keyword' : 'skill-highlight'"
          >{{ segment.label }}</span
        ><template v-else>{{ segment.label }}</template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.buff-tile-part {
  margin-top: 12px;
}

.buff-tile-heading {
  font-weight: 600;
}
</style>
