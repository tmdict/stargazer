<script setup lang="ts">
/* The page's column of lists, in the Formation engine rules page's groups,
   each with how many heroes it holds and who reads it, and a dot when
   the visitor changed it, the site changed it since, or it breaks a rule. */

import { computed } from 'vue'

import { opensElsewhere } from '@/composables/useDropdown'
import { useListEditor, useListWords } from './useListEditor'

const { current } = defineProps<{ current: string }>()

const emit = defineEmits<{ go: [name: string] }>()

const editor = useListEditor()
const { t, listName, readersLine, groupLists } = useListWords()

const groups = computed(() => groupLists(editor.names.value))

const anyBroken = computed(() =>
  editor.names.value.some((name) => editor.problems.value[name]!.length),
)

const readers = (name: string): string =>
  readersLine(
    name,
    editor.parentsOf(name).map((parent) => parent.list),
  )

function go(event: MouseEvent, name: string): void {
  if (opensElsewhere(event)) return
  event.preventDefault()
  emit('go', name)
}
</script>

<template>
  <div class="lists-index">
    <template v-for="group in groups" :key="group.key">
      <h3>
        {{ group.label }} <span>{{ group.names.length }}</span>
      </h3>
      <a
        v-for="name in group.names"
        :key="name"
        :href="`#${name}`"
        class="item"
        :aria-current="current === name ? 'true' : undefined"
        @click="go($event, name)"
      >
        <span class="name">
          <span class="text">{{ listName(name) }}</span>
          <i v-if="editor.isChanged(name)" class="lists-dot" />
          <i v-if="editor.isSiteChanged(name)" class="lists-dot theirs" />
          <i v-if="editor.problems.value[name]!.length" class="lists-dot bad" />
        </span>
        <span class="count">{{ editor.layouts.value[name]!.total }}</span>
        <span class="readers">{{ readers(name) }}</span>
      </a>
    </template>
    <p class="legend">
      <span><i class="lists-dot" />{{ t('lists-dot-mine') }}</span>
      <span><i class="lists-dot theirs" />{{ t('lists-dot-site') }}</span>
      <span v-if="anyBroken"><i class="lists-dot bad" />{{ t('lists-dot-broken') }}</span>
    </p>
  </div>
</template>

<style scoped>
.lists-index {
  padding: 8px;
  font-family: var(--font-ui);
  color: var(--reading-text);
}

h3 {
  display: flex;
  justify-content: space-between;
  margin: 10px 8px 4px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--reading-muted);
}

h3 span {
  letter-spacing: 0;
}

.item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0 8px;
  padding: 6px 8px;
  border-radius: var(--radius-medium);
  font-weight: normal;
  color: inherit;
  text-decoration: none;
}

.item:hover {
  background: var(--field-dark-background);
  color: inherit;
}

.item[aria-current='true'] {
  background: color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
}

.text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.count {
  font-size: 13px;
  color: var(--reading-muted);
}

.readers {
  grid-column: 1 / -1;
  overflow: hidden;
  font-size: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--reading-muted);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin: 10px 8px 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--reading-muted);
}

.legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
</style>
