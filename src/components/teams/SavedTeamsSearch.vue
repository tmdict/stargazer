<script setup lang="ts">
/* The Saved Teams tab's search field: hero pills plus free text in one box.
   Text that matches a hero name lists the matching heroes under the box;
   Enter or a click turns the lit one into a pill and clears the text for the
   next term. Team names never become pills: the text alone matches them.
   Backspace on empty text drops the last pill; the X clears pills and text
   together. Matching lives in useSavedTeamSearch; this component is the
   field and its combobox keyboard handling. */

import { computed, ref, useId, watch } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import type { SearchHero } from '@/composables/useSavedTeamSearch'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const { heroes, suggestions } = defineProps<{
  heroes: readonly SearchHero[]
  suggestions: readonly SearchHero[]
}>()

const emit = defineEmits<{
  addHero: [slug: string]
  removeHero: [slug: string]
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

const clearable = computed(() => heroes.length > 0 || query.value !== '')

const portrait = (slug: string): string => gameData.getCharacterImage(slug)

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
    emit('addHero', pick.slug)
  } else if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    dismissed.value = true
  } else if (event.key === 'Backspace' && query.value === '') {
    const last = heroes[heroes.length - 1]
    if (last) emit('removeHero', last.slug)
  }
}
</script>

<template>
  <div class="search-box" @mousedown="onMousedown" @click="inputEl?.focus()">
    <div class="search-field">
      <span v-for="hero in heroes" :key="hero.slug" class="hero-pill">
        <img v-if="portrait(hero.slug)" :src="portrait(hero.slug)" alt="" class="pill-portrait" />
        {{ hero.label }}
        <button
          type="button"
          class="pill-remove"
          :aria-label="`${i18n.t('app.remove-hero')}: ${hero.label}`"
          :title="i18n.t('app.remove-hero')"
          @click="emit('removeHero', hero.slug)"
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
      class="hero-list"
      role="listbox"
      :aria-label="i18n.t('app.search-hero-names')"
    >
      <li
        v-for="(hero, i) in suggestions"
        :id="`${listId}-${i}`"
        :key="hero.slug"
        class="hero-option"
        :class="{ sel: i === selected }"
        role="option"
        :aria-selected="i === selected"
        @click="emit('addHero', hero.slug)"
        @mousemove="selected = i"
      >
        <img v-if="portrait(hero.slug)" :src="portrait(hero.slug)" alt="" class="option-portrait" />
        {{ hero.label }}
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
  background: var(--color-bg-white);
  cursor: text;
}

.search-box:focus-within {
  border-color: var(--color-primary);
}

/* Pills and the input share one wrapping row, so a full row of pills pushes
   the input onto the next line rather than off the edge. */
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
  font-size: 0.8rem;
  color: var(--color-text-primary);
}

.search-input:focus {
  outline: none;
}

/* 16px floor: iOS zooms the page when a smaller field gains focus, and the
   zoom outlives the field. */
@media (pointer: coarse) {
  .search-input {
    font-size: 1rem;
  }
}

.hero-pill {
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

.hero-list {
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
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
}

.hero-option {
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

.hero-option.sel {
  background: var(--color-primary);
  color: #fff;
}

.option-portrait {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  object-fit: cover;
  object-position: center 15%;
  flex-shrink: 0;
}
</style>
