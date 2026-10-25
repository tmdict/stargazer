<script setup lang="ts">
/* The Saved Teams tab's search field: hero and artifact pills plus free text
   in one box. Text that matches a hero or artifact name lists the matching
   ones under the box; Enter or a click turns the lit one into a pill and
   clears the text for the next term. Team names never become pills: the text
   alone matches them.
   Backspace on empty text drops the last pill; the X clears pills and text
   together. Matching lives in useSavedTeamSearch; this component is the
   field and its combobox keyboard handling. */

import { computed, ref, useId, watch } from 'vue'

import ArtifactImage from '@/components/ArtifactImage.vue'
import IconClose from '@/components/ui/IconClose.vue'
import type { SearchPick } from '@/composables/useSavedTeamSearch'
import type { ArtifactType } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const { picks, suggestions } = defineProps<{
  picks: readonly SearchPick[]
  suggestions: readonly SearchPick[]
}>()

const emit = defineEmits<{
  addPick: [pick: SearchPick]
  removePick: [pick: SearchPick]
  clear: []
}>()

const query = defineModel<string>({ required: true })

const gameData = useGameDataStore()
const i18n = useI18nStore()
const listId = useId()

const inputEl = ref<HTMLInputElement>()
const focused = ref(false)
// Escape closes the list without touching the text; the next edit reopens it.
const dismissed = ref(false)
watch(query, () => {
  dismissed.value = false
})
const open = computed(() => focused.value && !dismissed.value && suggestions.length > 0)

const selected = ref(0)
watch(
  () => suggestions,
  () => {
    selected.value = 0
  },
)

const clearable = computed(() => picks.length > 0 || query.value !== '')

const portrait = (pick: SearchPick): string =>
  pick.kind === 'hero' ? gameData.getCharacterImage(pick.slug) : ''

const artifactOf = (pick: SearchPick): ArtifactType | undefined =>
  pick.kind === 'artifact' ? gameData.artifacts.find((a) => a.name === pick.slug) : undefined

const removeLabel = (pick: SearchPick): string =>
  i18n.t(pick.kind === 'hero' ? 'app.remove-hero' : 'app.remove-artifact')

// Every press inside the box keeps the caret in the input (pills, their
// remove buttons, the options, the X), so the list never blinks shut on a
// click meant for it; the input itself keeps its native caret placement.
const onMousedown = (event: MouseEvent): void => {
  if (event.target !== inputEl.value) event.preventDefault()
}

const onKeydown = (event: KeyboardEvent): void => {
  // IME composition keys (Enter commits, arrows pick candidates) must not
  // drive the list; keyCode 229 covers browsers that omit isComposing.
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (!open.value) return
    event.preventDefault()
    const n = suggestions.length
    selected.value = (selected.value + (event.key === 'ArrowDown' ? 1 : n - 1)) % n
  } else if (event.key === 'Enter') {
    const pick = open.value ? suggestions[selected.value] : undefined
    if (!pick) return
    event.preventDefault()
    emit('addPick', pick)
  } else if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    dismissed.value = true
  } else if (event.key === 'Backspace' && query.value === '') {
    const last = picks[picks.length - 1]
    if (last) emit('removePick', last)
  }
}
</script>

<template>
  <div class="search-box" @mousedown="onMousedown" @click="inputEl?.focus()">
    <div class="search-field">
      <span v-for="pick in picks" :key="`${pick.kind}:${pick.slug}`" class="pick-pill">
        <img v-if="portrait(pick)" :src="portrait(pick)" alt="" class="pill-portrait" />
        <span v-else-if="artifactOf(pick)" class="pill-portrait">
          <ArtifactImage :artifact="artifactOf(pick)!" />
        </span>
        {{ pick.label }}
        <button
          type="button"
          class="pill-remove"
          :aria-label="`${removeLabel(pick)}: ${pick.label}`"
          :title="removeLabel(pick)"
          @click="emit('removePick', pick)"
        >
          <IconClose :size="10" />
        </button>
      </span>
      <input
        ref="inputEl"
        v-model="query"
        class="search-input"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="open ? listId : undefined"
        :aria-activedescendant="open ? `${listId}-${selected}` : undefined"
        :placeholder="i18n.t('app.search-teams')"
        :aria-label="i18n.t('app.search-teams')"
        autocomplete="off"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
        @keydown="onKeydown"
      />
    </div>
    <!-- Hidden rather than removed while empty, so the input's width holds. -->
    <button
      type="button"
      class="search-clear"
      :class="{ idle: !clearable }"
      :aria-label="i18n.t('app.clear')"
      :title="i18n.t('app.clear')"
      @click="emit('clear')"
    >
      <IconClose :size="12" />
    </button>
    <ul
      v-if="open"
      :id="listId"
      class="pick-list"
      role="listbox"
      :aria-label="i18n.t('app.heroes-and-artifacts')"
    >
      <li
        v-for="(pick, i) in suggestions"
        :id="`${listId}-${i}`"
        :key="`${pick.kind}:${pick.slug}`"
        class="pick-option"
        :class="{ sel: i === selected }"
        role="option"
        :aria-selected="i === selected"
        @click="emit('addPick', pick)"
        @mousemove="selected = i"
      >
        <img v-if="portrait(pick)" :src="portrait(pick)" alt="" class="option-portrait" />
        <span v-else-if="artifactOf(pick)" class="option-portrait">
          <ArtifactImage :artifact="artifactOf(pick)!" />
        </span>
        {{ pick.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-box {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px 3px 10px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-raised);
  cursor: text;
}

.search-box:focus-within {
  border-color: var(--color-primary);
}

.search-field {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
}

.search-input {
  flex: 1 1 60px;
  min-width: 60px;
  border: 0;
  background: none;
  padding: 1px 2px;
  font: inherit;
  font-size: max(0.8rem, var(--field-min-font-size));
  color: var(--color-text-primary);
}

.search-input:focus {
  outline: none;
}

.pick-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 3px 1px 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: default;
}

.pill-portrait {
  display: block;
  overflow: hidden;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 15%;
}

.pill-remove {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
}

.pill-remove:hover {
  opacity: 1;
  background: color-mix(in srgb, var(--color-primary) 20%, transparent);
}

.search-clear {
  flex: none;
  display: inline-flex;
  padding: 3px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.search-clear.idle {
  visibility: hidden;
}

.search-clear:hover {
  color: var(--color-primary);
  background: var(--color-bg-tertiary);
}

.pick-list {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: var(--z-dropdown);
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-float);
}

.pick-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
  cursor: pointer;
}

.pick-option.sel {
  background: var(--color-primary);
  color: #fff;
}

.option-portrait {
  display: block;
  overflow: hidden;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: cover;
  object-position: center 15%;
  flex-shrink: 0;
}
</style>
