<script setup lang="ts">
/* The mechanic (tag) filter of a hero list: a menu of every tag with its
   modifiers, the picked tag's modifiers as chips beside it, and a switch that
   lays the tags out as chips instead. Counts come from `pool`, the list with
   the host's other filters applied. */

import { computed } from 'vue'

import DropdownRow from './ui/DropdownRow.vue'
import DropdownSelect from './ui/DropdownSelect.vue'
import FilterChip from './ui/FilterChip.vue'
import IconFilter from './ui/IconFilter.vue'
import { useMechanicsExpanded } from '@/composables/useMechanicsExpanded'
import { useNarrowViewport } from '@/composables/useNarrowViewport'
import { guidePath } from '@/lib/guide'
import { matchesPick, tagPick } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import { modifierLabel, tagLabel, tagPickLabel } from '@/utils/skillLabels'
import { loadTagVocabulary } from '@/utils/tagData'

const { pool } = defineProps<{ pool: readonly CharacterType[] }>()
const model = defineModel<TagPick | null>({ default: null })

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
const vocabulary = loadTagVocabulary()

// Phones keep the menu, with no way to expand it: the chip row would take
// most of a small sheet.
const { expanded: wantsChips, setExpanded } = useMechanicsExpanded()
const narrow = useNarrowViewport()
const expanded = computed(() => wantsChips.value && !narrow.value)
const segment = computed(() => (narrow.value ? undefined : expanded.value ? '−' : '+'))

const count = (pick: TagPick): number => pool.filter((c) => matchesPick(c.tags, pick)).length

const items = computed(() =>
  [...vocabulary].map(([tag, { mods, solo }]) => {
    const pick = tagPick(tag, vocabulary)
    return {
      pick,
      label: tagPickLabel(pick, lang.value),
      count: count(pick),
      // A solo tag's one modifier is already in its label.
      mods: (solo ? [] : mods).map((mod) => ({
        mod,
        pick: { tag, mods: [mod] },
        label: modifierLabel(mod, lang.value),
        count: count({ tag, mods: [mod] }),
      })),
    }
  }),
)

// Expanded, the picked tag shows as its chip, so the pill keeps its own name.
const triggerLabel = computed(() =>
  model.value && !expanded.value ? tagLabel(model.value.tag, lang.value) : i18n.t('app.mechanics'),
)

// Each chip's count is what the list would hold with that chip switched on,
// so a zero is a dead end; an active chip shows the current count.
const chips = computed(() => {
  const pick = model.value
  const info = pick && vocabulary.get(pick.tag)
  if (!pick || !info || info.solo) return []
  return info.mods.map((mod) => {
    const active = pick.mods.includes(mod)
    const toggled = active ? pick.mods.filter((m) => m !== mod) : [...pick.mods, mod].sort()
    return {
      mod,
      label: modifierLabel(mod, lang.value),
      active,
      count: count(active ? pick : { tag: pick.tag, mods: toggled }),
      toggled: { tag: pick.tag, mods: toggled },
    }
  })
})

const isPicked = (pick: TagPick): boolean => {
  const current = model.value
  return current?.tag === pick.tag && pick.mods.every((mod) => current.mods.includes(mod))
}

function choose(pick: TagPick | null, close: () => void) {
  model.value = pick
  close()
}

function toggleTag(pick: TagPick) {
  model.value = model.value?.tag === pick.tag ? null : pick
}
</script>

<template>
  <div class="mechanics">
    <DropdownSelect
      class="menu"
      large
      floating
      clearable
      :click-only="expanded"
      :label="triggerLabel"
      :lit="model !== null && !expanded"
      :segment
      :segment-label="i18n.t(expanded ? 'app.mechanics-collapse' : 'app.mechanics-expand')"
      @clear="model = null"
      @segment="setExpanded(!expanded)"
      @open="expanded && setExpanded(false)"
    >
      <template #icon>
        <IconFilter :size="15" />
      </template>
      <template #default="{ close }">
        <div class="menu-body" :lang>
          <DropdownRow
            class="all"
            :label="i18n.t('app.all')"
            :meta="pool.length"
            :selected="!model"
            @click="choose(null, close)"
          />
          <div class="items">
            <div v-for="item in items" :key="item.pick.tag" class="item">
              <DropdownRow
                :label="item.label"
                :meta="item.count"
                :selected="model?.tag === item.pick.tag"
                :disabled="item.count === 0 && model?.tag !== item.pick.tag"
                @click="choose(item.pick, close)"
              />
              <DropdownRow
                v-for="mod in item.mods"
                :key="mod.mod"
                sub
                :label="mod.label"
                :meta="mod.count"
                :selected="isPicked(mod.pick)"
                :disabled="mod.count === 0 && !isPicked(mod.pick)"
                @click="choose(mod.pick, close)"
              />
            </div>
          </div>
          <DropdownRow
            action
            :label="i18n.t('app.mechanics-guide')"
            meta="→"
            :to="guidePath(lang, 'mechanics')"
          />
        </div>
      </template>
    </DropdownSelect>

    <div v-if="chips.length > 0" class="mods">
      <FilterChip
        v-for="chip in chips"
        :key="chip.mod"
        large
        :label="chip.label"
        :count="chip.count"
        :active="chip.active"
        :disabled="!chip.active && chip.count === 0"
        @click="model = chip.toggled"
      />
    </div>

    <div v-if="expanded" class="tray">
      <FilterChip
        v-for="item in items"
        :key="item.pick.tag"
        :label="item.label"
        :count="item.count"
        :active="model?.tag === item.pick.tag"
        :disabled="item.count === 0 && model?.tag !== item.pick.tag"
        @click="toggleTag(item.pick)"
      />
    </div>
  </div>
</template>

<style scoped>
/* The dropdown and the chip group are separate items of the host's row, so a
   long chip group wraps to its own line and the dropdown stays put. */
.mechanics {
  display: contents;
}

/* A minimum, not a width: a long tag name widens the pill instead of being
   cut short. */
.menu {
  --dropdown-trigger-min-width: var(--dropdown-large-width);
}

/* "All" spans both columns: on the far edge its count would sit a whole
   panel away from the word. */
.all {
  justify-content: flex-start;
  gap: 6px;
  border-bottom: 1px solid var(--color-border-light);
}

.items {
  columns: 2;
  column-gap: 0;
  column-rule: 1px solid var(--color-border-light);
}

.item {
  min-width: 13.4rem;
  break-inside: avoid;
}

.mods {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.tray {
  display: flex;
  flex-wrap: wrap;
  flex-basis: 100%;
  gap: 6px;
}

@media (max-width: 768px) {
  /* Less the list's two borders. */
  .menu-body {
    width: calc(100vw - 2 * var(--spacing-sm) - 2px);
  }

  .items {
    columns: 1;
  }

  .item {
    min-width: 0;
  }

  .mods {
    flex-basis: 100%;
  }
}
</style>
