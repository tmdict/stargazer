<script setup lang="ts">
/* The mechanic filter of a hero list: a menu of every tag with its modifiers
   and of the energy filter, the pick's own controls beside it (a tag's
   modifiers as chips, the energy value's stepper), and a switch that lays the
   menu out as a row of chips instead. In that row the pick's controls follow
   its chip as parts of one pill. Counts come from `pool`, the list with the
   host's other filters applied. */

import { computed, ref } from 'vue'

import CharacterFilterEnergy from './CharacterFilterEnergy.vue'
import DropdownRow from './ui/DropdownRow.vue'
import DropdownSelect from './ui/DropdownSelect.vue'
import FilterChip from './ui/FilterChip.vue'
import IconFilter from './ui/IconFilter.vue'
import { useEnergyValue } from '@/composables/useEnergyValue'
import { useMechanicsExpanded } from '@/composables/useMechanicsExpanded'
import { useNarrowViewport } from '@/composables/useNarrowViewport'
import { usePillJoins, type PillJoin } from '@/composables/usePillJoins'
import { guidePath } from '@/lib/guide'
import {
  ENERGY_KEY,
  ENERGY_MIN,
  isEnergyPick,
  matchesMechanic,
  mechanicKeys,
  pickKey,
  type MechanicPick,
} from '@/lib/mechanics'
import { tagPick } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'
import { useI18nStore } from '@/stores/i18n'
import {
  mechanicLabel,
  mechanicPickLabel,
  modifierLabel,
  modifierLabelParts,
} from '@/utils/skillLabels'
import { loadTagVocabulary } from '@/utils/tagData'

const { pool } = defineProps<{ pool: readonly CharacterType[] }>()
const model = defineModel<MechanicPick | null>({ default: null })

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
const vocabulary = loadTagVocabulary()

// Phones keep the menu, with no way to expand it: the chip row would take
// most of a small sheet.
const { expanded: wantsChips, setExpanded } = useMechanicsExpanded()
const narrow = useNarrowViewport()
const expanded = computed(() => wantsChips.value && !narrow.value)
const segment = computed(() => (narrow.value ? undefined : expanded.value ? 'minus' : 'plus'))

const count = (pick: MechanicPick): number => pool.filter((c) => matchesMechanic(c, pick)).length

// Unpicked, the energy entry already names the value a pick would filter by.
const energyValue = useEnergyValue()
const energyAbove = computed({
  get: () => energyValue.value,
  set: (value) => {
    model.value = { energyAbove: value }
  },
})

// An entry no hero in the pool can match is a dead end. For a tag that is a
// zero count; the energy entry at zero can still be stepped down, so it is one
// only when no hero has any energy.
const items = computed(() =>
  mechanicKeys(vocabulary).map((key) => {
    const info = vocabulary.get(key)
    const pick: MechanicPick = info ? tagPick(key, vocabulary) : { energyAbove: energyAbove.value }
    const matching = count(pick)
    return {
      key,
      pick,
      label: mechanicPickLabel(pick, lang.value),
      count: matching,
      deadEnd: (info ? matching : count({ energyAbove: ENERGY_MIN })) === 0,
      // A solo tag's one modifier is already in its label.
      mods: (info && !info.solo ? info.mods : []).map((mod) => ({
        mod,
        pick: { tag: key, mods: [mod] },
        ...modifierLabelParts(mod, lang.value),
        count: count({ tag: key, mods: [mod] }),
      })),
    }
  }),
)

const pickedKey = computed(() => (model.value ? pickKey(model.value) : null))
const pickedTag = computed(() => (model.value && !isEnergyPick(model.value) ? model.value : null))
const energyCount = computed(() => count({ energyAbove: energyAbove.value }))

// Expanded, the pick shows as its chip, so the dropdown keeps its own name.
const triggerLabel = computed(() =>
  pickedKey.value && !expanded.value
    ? mechanicLabel(pickedKey.value, lang.value)
    : i18n.t('app.mechanics'),
)

// Each chip's count is what the list would hold with that chip switched on,
// so a zero is a dead end; an active chip shows the current count.
const chips = computed(() => {
  const pick = pickedTag.value
  const info = pick && vocabulary.get(pick.tag)
  if (!pick || !info || info.solo) return []
  return info.mods.map((mod) => {
    const active = pick.mods.includes(mod)
    const toggled = {
      tag: pick.tag,
      mods: active ? pick.mods.filter((m) => m !== mod) : [...pick.mods, mod].sort(),
    }
    const matching = count(active ? pick : toggled)
    return {
      mod,
      toggled,
      chip: {
        label: modifierLabel(mod, lang.value),
        count: matching,
        active,
        disabled: !active && matching === 0,
      },
    }
  })
})

// The picked entry, when it comes with controls of its own.
const controlled = computed(() =>
  pickedKey.value === ENERGY_KEY || chips.value.length > 0 ? pickedKey.value : null,
)

// In the row of chips those controls and the picked chip are the parts of one
// pill. The row spaces its chips by margin, not a gap, so neighbouring parts
// can overlap by a border and share one outline; its end padding is the room
// for that overlap.
const tray = ref<HTMLElement>()
const joins = usePillJoins(tray, '.part')
const APART: PillJoin = { left: false, right: false }
const joinOf = (part: number): PillJoin => joins.value[part] ?? APART

const isPicked = (pick: TagPick): boolean => {
  const current = pickedTag.value
  return current?.tag === pick.tag && pick.mods.every((mod) => current.mods.includes(mod))
}

function choose(pick: MechanicPick | null, close: () => void) {
  model.value = pick
  close()
}

function toggle(item: { key: string; pick: MechanicPick }) {
  model.value = pickedKey.value === item.key ? null : item.pick
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
            <div v-for="item in items" :key="item.key" class="item">
              <DropdownRow
                :label="item.label"
                :meta="item.count"
                :selected="pickedKey === item.key"
                :disabled="item.deadEnd && pickedKey !== item.key"
                @click="choose(item.pick, close)"
              />
              <DropdownRow
                v-for="mod in item.mods"
                :key="mod.mod"
                sub
                :lead="mod.hero"
                :label="mod.rest"
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

    <div v-if="controlled && !expanded" class="mods">
      <CharacterFilterEnergy
        v-if="controlled === ENERGY_KEY"
        v-model="energyAbove"
        active
        :count="energyCount"
        :lang
      />
      <FilterChip
        v-for="{ mod, toggled, chip } in chips"
        :key="mod"
        large
        v-bind="chip"
        @click="model = toggled"
      />
    </div>

    <div v-if="expanded" ref="tray" class="tray">
      <template v-for="item in items" :key="item.key">
        <FilterChip
          :class="{ part: item.key === controlled }"
          :label="item.label"
          :count="item.count"
          :active="pickedKey === item.key"
          :disabled="item.deadEnd && pickedKey !== item.key"
          :join="item.key === controlled ? joinOf(0) : undefined"
          @click="toggle(item)"
        />
        <template v-if="item.key === controlled">
          <CharacterFilterEnergy
            v-if="controlled === ENERGY_KEY"
            v-model="energyAbove"
            class="part"
            compact
            active
            :count="energyCount"
            :join="joinOf(1)"
            :lang
          />
          <FilterChip
            v-for="({ mod, toggled, chip }, i) in chips"
            :key="mod"
            class="part"
            v-bind="chip"
            :join="joinOf(i + 1)"
            @click="model = toggled"
          />
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* The dropdown and the chip group are separate items of the host's row, so a
   long chip group wraps to its own line and the dropdown stays put. */
.mechanics {
  display: contents;
}

.menu {
  --dropdown-trigger-min-width: var(--dropdown-large-width);
}

.menu-body {
  --dropdown-row-lead: var(--upgrade-pill-refinement-max);
}

.all {
  justify-content: flex-start;
  gap: 6px;
}

.items {
  columns: 2;
  column-gap: calc(2 * var(--dropdown-list-padding) + 1px);
  column-rule: 1px solid var(--color-border-light);
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}

.item {
  min-width: 12.9rem;
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
  row-gap: var(--spacing-sm);
  padding-right: var(--chip-border);
}

.tray > * {
  margin-right: var(--spacing-md);
}

.tray > .part:has(+ .part) {
  margin-right: calc(-1 * var(--chip-border));
}

@media (max-width: 768px) {
  .menu-body {
    width: calc(100vw - 2 * var(--spacing-sm) - 2px - 2 * var(--dropdown-list-padding));
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
