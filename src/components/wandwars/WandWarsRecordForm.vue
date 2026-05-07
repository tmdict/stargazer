<script setup lang="ts">
import { computed, ref } from 'vue'

import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useI18nStore } from '@/stores/i18n'
import type { PickState, RecordedMatch } from '@/wandwars/types'

const props = defineProps<{
  pickState: PickState
}>()

const emit = defineEmits<{
  submit: [record: RecordedMatch]
}>()

const i18n = useI18nStore()

const winner = ref<'left' | 'right' | 'draw'>('left')
const dominant = ref(false)
const notes = ref('')

const showTooltip = ref(false)
const iconEl = ref<InstanceType<typeof IconInfo> | null>(null)
const titleEl = computed(() => iconEl.value?.$el as HTMLElement | undefined)

const resultKey = computed(() => {
  if (winner.value === 'draw') return 'draw'
  return `${winner.value}-${dominant.value ? 'dominant' : 'normal'}`
})

function setResult(w: 'left' | 'right' | 'draw', d: boolean) {
  winner.value = w
  dominant.value = d
}

function handleSubmit() {
  emit('submit', {
    left: [...props.pickState.left] as [string, string, string],
    right: [...props.pickState.right] as [string, string, string],
    winner: winner.value,
    dominant: winner.value !== 'draw' && dominant.value,
    notes: notes.value.trim(),
  })
  winner.value = 'left'
  dominant.value = false
  notes.value = ''
}
</script>

<template>
  <div class="record-form">
    <h4 class="record-form-title">
      {{ i18n.t('wandwars.record-match') }}
      <IconInfo
        ref="iconEl"
        :size="14"
        class="record-info-icon"
        @mouseenter="showTooltip = true"
        @mouseleave="showTooltip = false"
      />
    </h4>
    <div class="result-buttons">
      <button
        :class="['result-btn', 'left', 'dominant', { active: resultKey === 'left-dominant' }]"
        @click="setResult('left', true)"
      >
        {{ i18n.t('wandwars.left-win-sweep') }}
      </button>
      <button
        :class="['result-btn', 'left', { active: resultKey === 'left-normal' }]"
        @click="setResult('left', false)"
      >
        {{ i18n.t('wandwars.left-win') }}
      </button>
      <button
        :class="['result-btn', 'draw', { active: resultKey === 'draw' }]"
        @click="setResult('draw', false)"
      >
        {{ i18n.t('wandwars.draw') }}
      </button>
      <button
        :class="['result-btn', 'right', { active: resultKey === 'right-normal' }]"
        @click="setResult('right', false)"
      >
        {{ i18n.t('wandwars.right-win') }}
      </button>
      <button
        :class="['result-btn', 'right', 'dominant', { active: resultKey === 'right-dominant' }]"
        @click="setResult('right', true)"
      >
        {{ i18n.t('wandwars.right-win-sweep') }}
      </button>
    </div>
    <textarea
      v-model="notes"
      class="notes-input"
      rows="2"
      :placeholder="i18n.t('wandwars.messages/notes-placeholder')"
    />
    <button class="submit-btn" @click="handleSubmit">
      {{ i18n.t('wandwars.save-result') }}
    </button>
    <p class="record-tip">{{ i18n.t('wandwars.messages/reset-after-save') }}</p>

    <Teleport to="body">
      <TooltipPopup
        v-if="showTooltip && titleEl"
        :target-element="titleEl"
        variant="detailed"
        :text="i18n.t('wandwars.messages/tooltip-sweep')"
        max-width="260px"
      />
    </Teleport>
  </div>
</template>

<style scoped>
.record-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
}

.record-form-title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-primary);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.record-info-icon {
  color: var(--color-text-secondary);
  cursor: help;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.record-info-icon:hover {
  opacity: 1;
}

.result-buttons {
  display: flex;
  gap: 2px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  overflow: hidden;
}

.result-btn {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-xs);
  border: none;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.result-btn.left.active {
  background: var(--color-ally);
  color: white;
}

.result-btn.left.dominant.active {
  background: var(--color-ally);
  color: white;
  font-weight: 700;
}

.result-btn.draw.active {
  background: var(--color-text-secondary);
  color: white;
}

.result-btn.right.active {
  background: var(--color-enemy);
  color: white;
}

.result-btn.right.dominant.active {
  background: var(--color-enemy);
  color: white;
  font-weight: 700;
}

.result-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
}

.notes-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  font-family: inherit;
  background: var(--color-bg-white);
  resize: vertical;
}

.notes-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.submit-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.submit-btn:hover {
  background: var(--color-primary-hover);
}

.record-tip {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-light);
  text-align: center;
}
</style>
