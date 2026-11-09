<script setup lang="ts">
/* The open list as the visitor has it beside the site's version now, ranked
   heroes place by place, with the places that differ marked. */

import { computed } from 'vue'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import { expandList } from '@/lib/placement/lists'
import { heroesMatching, heroOf } from '../rules/useRules'
import { SITE_LISTS, useListEditor, useListWords } from './useListEditor'

const emit = defineEmits<{ keep: []; take: []; close: [] }>()

const editor = useListEditor()
const { lang, t, listName, heroNameById } = useListWords()

const name = computed(() => editor.current.value)

const columns = computed(() => {
  const read = (lists: typeof SITE_LISTS) =>
    expandList(lists, name.value, { heroesMatching }) ?? { ranked: [], equal: [] }
  const mine = read(editor.lists.value)
  const site = read({ ...editor.lists.value, [name.value]: SITE_LISTS[name.value]! })
  return [
    { title: t('lists-compare-yours'), heroes: mine, other: site.ranked },
    { title: t('lists-compare-site'), heroes: site, other: mine.ranked },
  ]
})
</script>

<template>
  <section>
    <h2>{{ t('lists-compare-title', { list: listName(name) }) }}</h2>
    <p class="reading-meta">{{ t('lists-compare-hint') }}</p>
    <div class="columns">
      <div v-for="column in columns" :key="column.title">
        <h3>{{ column.title }}</h3>
        <ol>
          <li
            v-for="(id, index) in column.heroes.ranked"
            :key="id"
            :class="{ differs: column.other[index] !== id }"
          >
            <span class="at">{{ index + 1 }}</span>
            <GuidePortrait v-if="heroOf(id)" :slug="heroOf(id)!.name" :lang :size="24" />
            {{ heroNameById(id) }}
          </li>
        </ol>
        <p v-if="column.heroes.equal.length" class="reading-meta">
          {{ t('lists-compare-line', { n: column.heroes.equal.length }) }}
        </p>
      </div>
    </div>
    <div class="actions">
      <span class="spacer" />
      <button type="button" class="lists-btn" @click="emit('keep')">{{ t('lists-keep') }}</button>
      <button type="button" class="lists-btn" @click="emit('take')">{{ t('lists-take') }}</button>
      <button type="button" class="lists-btn" @click="emit('close')">{{ t('close') }}</button>
    </div>
  </section>
</template>

<style scoped>
h2 {
  margin-top: 0;
  padding-right: 40px;
}

.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

h3 {
  margin: 0 0 6px;
  font-family: var(--font-ui);
  font-size: 13px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--reading-muted);
}

ol {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 2px 6px;
  border-radius: var(--radius-medium);
  font-family: var(--font-ui);
  font-size: 14px;
}

li.differs {
  background: color-mix(in srgb, var(--color-warning) 18%, transparent);
}

.at {
  min-width: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--reading-muted);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.spacer {
  flex: 1;
}

@media (max-width: 700px) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
