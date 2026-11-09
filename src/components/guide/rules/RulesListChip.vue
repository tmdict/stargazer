<script setup lang="ts">
/* A button for a list the rules read: its first heroes, its name and how many
   it ranks, opening it beside the rules or in a pop-up. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { groupSize, heroOf, listPeek, RULE_LISTS, useRulesNames } from './useRules'

const { name, pressed = undefined } = defineProps<{ name: string; pressed?: boolean }>()

const emit = defineEmits<{ open: [name: string] }>()

const { lang, t, listName } = useRulesNames()

const list = computed(() => RULE_LISTS[name]!)
const peek = computed(() => listPeek(list.value).flatMap((id) => heroOf(id)?.name ?? []))
const count = computed(() => {
  const ranked = groupSize(list.value.ranked)
  const below = groupSize(list.value.equal)
  if (!ranked) return t('rules-count-equal', { count: below })
  return below ? t('rules-count-below', { ranked, below }) : t('rules-count-ranked', { ranked })
})
</script>

<template>
  <button type="button" class="rules-chip" :aria-pressed="pressed" @click="emit('open', name)">
    <span class="peek">
      <GuidePortrait v-for="slug in peek" :key="slug" :slug :lang />
    </span>
    <span class="words">
      <span class="name">{{ listName(name) }}</span>
      <span class="count">{{ count }}</span>
    </span>
    <IconChevronRight :size="14" class="chevron" />
  </button>
</template>

<style scoped>
.rules-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 3px 8px 3px 6px;
  border: 1px solid var(--chip-dark-border-color);
  border-radius: 18px;
  background: var(--field-dark-background);
  color: var(--reading-text);
  font-family: var(--font-ui);
  text-align: left;
  cursor: pointer;
}

.rules-chip:hover,
.rules-chip[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--chip-dark-active-background);
}

.peek {
  --size: 24px;
  --disc-ring: var(--color-bg-reading);
  display: inline-flex;
  flex: none;
}

.peek > * + * {
  margin-left: -7px;
}

.words {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.name {
  font-size: 13px;
  font-weight: 600;
}

.count {
  font-size: 12px;
  color: var(--reading-muted);
}

.chevron {
  flex: none;
  color: var(--reading-muted);
}
</style>
