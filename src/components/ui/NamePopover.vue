<script setup lang="ts">
/* A name box that opens under the button in its default slot, for saving
   something new under a name: Enter or Save commits, Esc or Cancel closes.
   It opens with `name` filled in and selected. `end` lines its right edge up
   with the button's, for a button near the right edge of a narrow screen. */

import { ref, useId, watch } from 'vue'

import { MAX_NAME_LENGTH } from '@/lib/names'
import { useI18nStore } from '@/stores/i18n'

const {
  label,
  name,
  end = false,
} = defineProps<{
  label: string
  name: string
  end?: boolean
}>()

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ commit: [name: string] }>()

const i18n = useI18nStore()
const inputId = useId()
const value = ref('')
const input = ref<HTMLInputElement>()

watch(
  open,
  (isOpen) => {
    if (isOpen) value.value = name
  },
  { immediate: true },
)
watch(
  input,
  (el) => {
    el?.focus()
    el?.select()
  },
  { flush: 'post' },
)

const commit = (): void => {
  open.value = false
  emit('commit', value.value)
}

// The key that ends an IME composition must not also save or close the box;
// keyCode 229 covers browsers that omit isComposing.
const composing = (event: KeyboardEvent): boolean => event.isComposing || event.keyCode === 229

const onEnter = (event: KeyboardEvent): void => {
  if (composing(event)) return
  event.preventDefault()
  commit()
}

// Esc goes no further than the box, so a page-wide Esc (the hero grid's
// Select mode beside the generator's Save) keeps its own state.
const onEsc = (event: KeyboardEvent): void => {
  if (!composing(event)) open.value = false
}
</script>

<template>
  <span class="popover-anchor">
    <slot />
    <div v-if="open" class="name-popover" :class="{ end }" role="dialog" :aria-label="label">
      <label class="name-popover-label" :for="inputId">{{ label }}</label>
      <input
        :id="inputId"
        ref="input"
        v-model="value"
        class="name-popover-input"
        type="text"
        :maxlength="MAX_NAME_LENGTH"
        spellcheck="false"
        @keydown.enter="onEnter"
        @keydown.esc.stop="onEsc"
      />
      <div class="name-popover-actions">
        <button type="button" class="popover-btn solid-btn" @click="commit">
          {{ i18n.t('app.save') }}
        </button>
        <button type="button" class="popover-btn solid-btn secondary" @click="open = false">
          {{ i18n.t('app.cancel') }}
        </button>
      </div>
    </div>
  </span>
</template>

<style scoped>
.popover-anchor {
  position: relative;
  display: inline-flex;
}

.name-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-dropdown);
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-float);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 240px;
}

.name-popover.end {
  left: auto;
  right: 0;
  transform: none;
}

.name-popover-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.name-popover-input {
  font: inherit;
  font-size: max(0.85rem, var(--field-min-font-size));
  padding: 6px 8px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-raised);
  color: var(--color-text-primary);
}

.name-popover-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.name-popover-actions {
  display: flex;
  gap: var(--spacing-sm);
}

/* Not .control-btn, so the control bar's mobile icon-only collapse never
   applies inside the popover. */
.popover-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 4px 8px;
  font-size: 0.8rem;
}
</style>
