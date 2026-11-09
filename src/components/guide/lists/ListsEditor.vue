<script setup lang="ts">
/* The open list: its name and counts, how its order matters, what the site
   changed or a rule refuses, the rules that read it, then its entries and the
   site's entries the visitor took off. */

import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import ListsCard from './ListsCard.vue'
import ListsChips from './ListsChips.vue'
import ListsReaders from './ListsReaders.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import { entryKey } from '@/lib/placement/listEdits'
import { heroOf } from '../rules/useRules'
import { matchesChips } from './heroChips'
import { useListDragState } from './useListDrag'
import { SITE_LISTS, useListEditor, useListWords } from './useListEditor'

const emit = defineEmits<{ go: [name: string]; compare: [] }>()

const editor = useListEditor()
const drag = useListDragState()
const { lang, t, listName, entryName, and } = useListWords()

const name = computed(() => editor.current.value)
const entries = computed(() => editor.lists.value[name.value] ?? [])
const layout = computed(() => editor.layouts.value[name.value]!)
const diff = computed(() => editor.diffOf(name.value))
const changed = computed(() => editor.isChanged(name.value))
const problems = computed(() => editor.problems.value[name.value] ?? [])

const countLine = computed(() => {
  const { total, ranked, below, hasLine } = layout.value
  return hasLine ? t('lists-count-line', { total, ranked, below }) : t('hero-count', { n: total })
})

// How a list's order counts, from what the rules reading it, or a list that
// brings it in, want of it.
const order = computed(() => {
  const uses = editor.usesOf(name.value)
  const { hasLine, ranked } = layout.value
  if (!uses.size) return { free: true, text: t('lists-no-reader') }
  if (hasLine && !ranked) return { free: true, text: t('lists-order-free-all') }
  if (uses.has('first') || uses.has('first-others') || uses.has('avoid'))
    return { free: false, text: t(hasLine ? 'lists-order-matters-line' : 'lists-order-matters') }
  return { free: true, text: t(hasLine ? 'lists-order-line-first' : 'lists-order-free') }
})

const problemText = computed(() =>
  t('lists-problems', {
    problems: and(problems.value.map((problem) => t(`lists-problem-${problem}`))),
  }),
)

const readOpen = ref(false)
const highlight = ref(new Set<string>())
const expanded = ref(new Set<string>())

// A key per card, unique when an entry stands twice (a second line).
const rows = computed(() => {
  const seen = new Map<string, number>()
  return layout.value.rows.map((row) => {
    const entry = entries.value[row.index]!
    const key = entryKey(entry)
    const times = seen.get(key) ?? 0
    seen.set(key, times + 1)
    const was = diff.value.moved.get(key)
    const hero = row.kind === 'hero' ? heroOf(row.hero.id) : undefined
    return {
      row,
      key,
      id: times ? `${key}~${times}` : key,
      name: entryName(entry),
      change: diff.value.added.has(key)
        ? { kind: 'new' as const }
        : was === undefined
          ? null
          : { kind: 'moved' as const, was },
      also:
        row.kind === 'hero'
          ? layout.value.rows.flatMap((other) =>
              other !== row &&
              (other.kind === 'list' || other.kind === 'every') &&
              other.items.some((item) => item.id === row.hero.id)
                ? [entryName(entries.value[other.index]!, true)]
                : [],
            )
          : [],
      dim: !!hero && highlight.value.size > 0 && !matchesChips(hero, highlight.value),
    }
  })
})

const removed = computed(() =>
  diff.value.removed.flatMap((key) => {
    const entry = SITE_LISTS[name.value]!.find((other) => entryKey(other) === key)
    return entry === undefined ? [] : [{ key, entry }]
  }),
)

function toggle(key: string): void {
  const next = new Set(expanded.value)
  if (!next.delete(key)) next.add(key)
  expanded.value = next
}

function onKey(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  if (target.matches('input, button')) return
  const card = target.closest<HTMLElement>('[data-index]')
  if (!card || card !== target) return
  const index = Number(card.dataset.index)
  const up = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
  const down = event.key === 'ArrowDown' || event.key === 'ArrowRight'
  if (event.key === 'Delete' || event.key === 'Backspace') editor.remove(index)
  else if (event.altKey && (up || down)) editor.move(index, index + (up ? -1 : 1))
  else return
  event.preventDefault()
}

const grid = useTemplateRef<HTMLElement>('grid')
const cardOf = (key: string): HTMLElement | null =>
  grid.value?.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`) ?? null

watch(
  editor.focusKey,
  async (key) => {
    if (key === null) return
    editor.focusKey.value = null
    await nextTick()
    const card = cardOf(key)
    card?.focus({ preventScroll: true })
    card?.scrollIntoView({ block: 'nearest' })
  },
  { flush: 'post' },
)

watch(
  editor.flashKey,
  (key) => {
    const card = key === null ? null : cardOf(key)
    if (!card) return
    card.classList.remove('flash')
    void card.offsetWidth
    card.classList.add('flash')
    card.scrollIntoView({ block: 'center' })
  },
  { flush: 'post' },
)
</script>

<template>
  <div class="lists-editor">
    <div class="head">
      <h2>{{ listName(name) }}</h2>
      <span class="count">{{ countLine }}</span>
      <span class="badge" :class="{ free: order.free }">{{ order.text }}</span>
      <span v-if="changed" class="badge mine">{{ t('lists-yours') }}</span>
      <span class="spacer" />
      <button v-if="!layout.hasLine" type="button" class="lists-btn small" @click="editor.addLine">
        {{ t('lists-add-line') }}
      </button>
      <button type="button" class="lists-btn small" :disabled="!changed" @click="editor.resetList">
        {{ t('lists-back-one') }}
      </button>
    </div>

    <div v-if="editor.isSiteChanged(name)" class="lists-notice">
      <span>{{ t('lists-site-changed') }}</span>
      <button type="button" class="lists-btn small" @click="emit('compare')">
        {{ t('lists-compare') }}
      </button>
      <button type="button" class="lists-btn small" @click="editor.keepMine">
        {{ t('lists-keep') }}
      </button>
      <button type="button" class="lists-btn small" @click="editor.takeSite">
        {{ t('lists-take') }}
      </button>
    </div>
    <div v-if="problems.length" class="lists-notice bad">
      <span>{{ problemText }}</span>
    </div>

    <ListsReaders v-model:open="readOpen" :name @go="emit('go', $event)" />

    <div class="lists-bar">
      <span class="lists-label">{{ t('lists-highlight') }}</span>
      <ListsChips v-model="highlight" :groups="['range', 'damage', 'class']" />
      <button
        v-if="highlight.size"
        type="button"
        class="lists-btn small"
        @click="highlight = new Set()"
      >
        {{ t('clear') }}
      </button>
    </div>

    <div class="wrap" data-drag="wrap">
      <div ref="grid" class="grid" data-drag="grid" @keydown="onKey">
        <ListsCard
          v-for="card in rows"
          :key="card.id"
          :data-index="card.row.index"
          :data-key="card.key"
          :row="card.row"
          :name="card.name"
          :change="card.change"
          :also="card.also"
          :dim="card.dim"
          :open="expanded.has(card.key)"
          :lifted="drag.lifted.value === card.row.index"
          @remove="editor.remove(card.row.index)"
          @rank="editor.moveToRank(card.row.index, $event)"
          @toggle="toggle(card.key)"
          @open-list="emit('go', $event)"
        />
        <p v-if="!rows.length" class="empty">{{ t('lists-empty') }}</p>
      </div>
      <div
        v-if="drag.marker.value"
        class="marker"
        :style="{
          left: `${drag.marker.value.left}px`,
          top: `${drag.marker.value.top}px`,
          width: `${drag.marker.value.width}px`,
        }"
      />
    </div>

    <div v-if="removed.length" class="removed">
      <span class="lists-label">{{ t('lists-removed') }}</span>
      <span v-for="item in removed" :key="item.key" class="lists-mini">
        <GuidePortrait
          v-if="typeof item.entry === 'number' && heroOf(item.entry)"
          :slug="heroOf(item.entry)!.name"
          :lang
          :size="20"
        />
        {{ entryName(item.entry) }}
        <button type="button" class="put-back" @click="editor.putBack(item.key)">
          {{ t('lists-put-back') }}
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.lists-editor {
  padding: 18px 20px 24px;
  font-family: var(--font-ui);
  color: var(--reading-text);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 14px;
  margin-bottom: 10px;
}

h2 {
  padding: 0;
  border: 0;
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--reading-text);
}

.count {
  font-size: 15px;
  color: var(--reading-muted);
}

.badge {
  padding: 1px 9px;
  border-radius: 10px;
  background: var(--chip-dark-active-background);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-accent);
}

.badge.free {
  border: 1px solid var(--panel-dark-edge);
  background: var(--field-dark-background);
  color: var(--reading-muted);
}

.badge.mine {
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
  color: var(--color-warning);
}

.spacer {
  flex: 1;
}

.wrap {
  position: relative;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  min-height: 64px;
  padding: 2px;
}

.empty {
  margin: 0;
  padding: 18px;
  border: 2px dashed var(--chip-dark-border-color);
  border-radius: var(--radius-large);
  font-size: 14px;
  text-align: center;
  color: var(--reading-muted);
}

.marker {
  position: absolute;
  z-index: 5;
  height: 4px;
  border-radius: 2px;
  background: var(--color-accent);
  pointer-events: none;
}

.removed {
  margin-top: 14px;
  padding: 10px 14px;
  border: 1px dashed var(--chip-dark-border-color);
  border-radius: var(--radius-large);
}

.removed .lists-mini {
  margin: 3px 4px 3px 0;
  padding-right: 3px;
}

.put-back {
  padding: 0 7px;
  border: 0;
  border-radius: 10px;
  background: var(--color-bg-reading);
  font: inherit;
  color: var(--color-accent);
  cursor: pointer;
}

.put-back:hover {
  text-decoration: underline;
}

@media (max-width: 700px) {
  .lists-editor {
    padding: 14px;
  }
}
</style>
