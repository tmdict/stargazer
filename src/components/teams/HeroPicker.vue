<script setup lang="ts">
/* A board-free hero picker for the import review: the roster's name search
   (every warm locale) over the full character list, with the reader's own
   candidates offered first. Closes on pick, Escape, or an outside click. */

import { computed, onMounted, ref } from 'vue'

import { useOverlay } from '@/composables/useOverlay'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import { useTouchDetection } from '@/composables/useTouchDetection'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { suggestions } = defineProps<{
  // Character ids to list before the search, best first.
  suggestions: readonly number[]
}>()

const emit = defineEmits<{
  pick: [characterId: number | null]
  close: []
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const { isTouchDevice } = useTouchDetection()

const rootRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const query = ref('')

useOverlay({ elementRef: rootRef, onClose: () => emit('close'), clickOutsideDelay: 100 })

onMounted(() => {
  if (!isTouchDevice.value) inputRef.value?.focus()
})

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

const label = (name: string): string => localizedDisplayName(i18n.t, 'character', name)

const suggested = computed(() =>
  suggestions.map((id) => gameData.getCharacterById(id)).filter((c) => c !== undefined),
)

const matches = computed(() => {
  const q = query.value.trim()
  if (q.length === 0) return heroes.value
  const slugs = matchCharacterNames(q)
  return heroes.value.filter((c) => slugs.has(c.name))
})
</script>

<template>
  <div ref="rootRef" class="hero-picker" role="dialog" :aria-label="i18n.t('app.import-pick-hero')">
    <input
      ref="inputRef"
      v-model="query"
      class="picker-input"
      type="search"
      :placeholder="i18n.t('app.search-hero-names')"
      spellcheck="false"
      @keydown.esc="emit('close')"
    />
    <div class="picker-list">
      <button type="button" class="picker-row none" @click="emit('pick', null)">
        {{ i18n.t('app.import-no-hero') }}
      </button>
      <template v-if="query.trim().length === 0 && suggested.length">
        <div class="picker-group">{{ i18n.t('app.search-best-matches') }}</div>
        <button
          v-for="hero in suggested"
          :key="`s-${hero.id}`"
          type="button"
          class="picker-row"
          @click="emit('pick', hero.id)"
        >
          <img class="picker-portrait" :src="gameData.getCharacterImage(hero.name)" alt="" />
          <span>{{ label(hero.name) }}</span>
        </button>
        <div class="picker-group">{{ i18n.t('app.characters') }}</div>
      </template>
      <button
        v-for="hero in matches"
        :key="hero.id"
        type="button"
        class="picker-row"
        @click="emit('pick', hero.id)"
      >
        <img class="picker-portrait" :src="gameData.getCharacterImage(hero.name)" alt="" />
        <span>{{ label(hero.name) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.hero-picker {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: var(--z-dropdown);
  width: 240px;
  max-width: calc(100vw - 32px);
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.picker-input {
  font: inherit;
  font-size: 0.85rem;
  padding: 6px 8px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
  color: var(--color-text-primary);
}

.picker-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

@media (pointer: coarse) {
  .picker-input {
    font-size: 1rem;
  }
}

.picker-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.picker-group {
  font-size: 0.66rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
  padding: 6px 6px 2px;
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border: none;
  background: none;
  border-radius: var(--radius-medium);
  font: inherit;
  font-size: 0.82rem;
  color: var(--color-text-primary);
  text-align: left;
  cursor: pointer;
}

.picker-row:hover,
.picker-row:focus-visible {
  background: var(--color-bg-tertiary);
  color: var(--color-primary);
}

.picker-row.none {
  color: var(--color-text-secondary);
}

.picker-portrait {
  width: 22px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
</style>
