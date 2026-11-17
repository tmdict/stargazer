<script setup lang="ts">
/* The search box at the top of a pick-from-a-list popup. Enter is reported
   once the text is committed, for the list to take a search's single match. */

import { onMounted, useTemplateRef } from 'vue'

import { isComposing } from '@/utils/keyboard'

const { touchFocus = false } = defineProps<{
  placeholder: string
  touchFocus?: boolean
}>()

const emit = defineEmits<{ enter: [] }>()

const query = defineModel<string>({ required: true })

// Type-to-pick: focus starts in the search box on a pointer device. On touch
// the keyboard would cover the list, so only an owner that asks for it focuses
// there: the hero palette's on-grid popup exists only on tablet-and-wider
// layouts (phones place via the picker sheet) and iPad taps land here expecting
// to type, and the import review's keyboard is the way to find a hero among the
// pinned candidates. Focusing in the mount tick matters: iPadOS raises the
// keyboard only while the opening tap's user activation is live.
const input = useTemplateRef<HTMLInputElement>('input')
onMounted(() => {
  if (touchFocus || window.matchMedia('(hover: hover)').matches) {
    input.value?.focus({ preventScroll: true })
  }
})

// The Enter that commits an IME composition must not double as a pick.
const enter = (event: KeyboardEvent): void => {
  if (!isComposing(event)) emit('enter')
}
</script>

<template>
  <!-- type="search" for the native clear button. -->
  <input
    ref="input"
    v-model="query"
    type="search"
    class="search-input"
    :placeholder
    :aria-label="placeholder"
    @keydown.enter="enter"
  />
</template>

<style scoped>
.search-input {
  width: calc(100% - 2 * var(--palette-inset));
  box-sizing: border-box;
  margin: 0 var(--palette-inset) 8px;
  padding: var(--field-dark-padding);
  font: inherit;
  font-size: max(var(--field-dark-font-size), var(--field-min-font-size));
  color: #fff;
  background: var(--field-dark-background);
  border: var(--field-dark-border);
  border-radius: var(--field-dark-radius);
  transition: border-color 0.15s ease;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.search-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
}

.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  height: 12px;
  width: 12px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23ccc' stroke-width='1.4' stroke-linecap='round'><path d='M2 2 L10 10 M10 2 L2 10'/></svg>")
    no-repeat center / 12px 12px;
  cursor: pointer;
  opacity: 0.6;
}

.search-input::-webkit-search-cancel-button:hover {
  opacity: 1;
}
</style>
