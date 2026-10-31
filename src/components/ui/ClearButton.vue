<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ConfirmLabel from './ConfirmLabel.vue'
import IconTrash from './IconTrash.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { usePanelClamp } from '@/composables/usePanelClamp'
import { useTouchDetection } from '@/composables/useTouchDetection'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

export interface ClearSide {
  team: Team
  disabled: boolean
}

const { confirmFirst = false, sides = [] } = defineProps<{
  // Two-step confirm before firing (the Teams page; the Arena clears instantly).
  confirmFirst?: boolean
  // One-side clears offered in a tray while the confirm is armed.
  sides?: readonly ClearSide[]
}>()

const emit = defineEmits<{
  click: []
  clearSide: [team: Team]
}>()

const i18n = useI18nStore()
const { isTouchDevice } = useTouchDetection()
const { armed, confirm, disarm, pause, resume } = useArmedConfirm()

const handleClick = (): void => {
  if (confirmFirst && !confirm('clear')) return
  emit('click')
}

const trayOpen = computed(() => armed.value !== null && sides.length > 0)

const pickSide = (team: Team): void => {
  disarm()
  emit('clearSide', team)
}

// The armed window holds while a mouse rests on the control or focus is in
// the tray, so it cannot lapse mid-choice. Touch is left out, because a tap
// fires a synthetic mouseenter that would hold it until the next tap elsewhere.
const hovered = ref(false)
const trayFocused = ref(false)
// A tray removed while focused fires no focusout.
watch(trayOpen, () => (trayFocused.value = false))
watch(
  () => trayOpen.value && (hovered.value || trayFocused.value),
  (held) => (held ? pause() : resume()),
)

const onMouseEnter = (): void => {
  if (!isTouchDevice.value) hovered.value = true
}

const buttonRef = ref<HTMLElement>()
const trayRef = ref<HTMLElement>()
const trayShift = usePanelClamp(buttonRef, trayRef, () => trayOpen.value)

const onTrayFocusOut = (e: FocusEvent): void => {
  trayFocused.value = trayRef.value?.contains(e.relatedTarget as Node | null) ?? false
}
</script>

<template>
  <span
    class="clear-control"
    @mouseenter="onMouseEnter"
    @mouseleave="hovered = false"
    @keydown.esc="disarm"
  >
    <button
      ref="buttonRef"
      @click="handleClick"
      class="control-btn danger"
      :class="{ 'confirm-armed': armed !== null }"
      :title="i18n.t(armed !== null ? 'app.confirm' : 'app.clear')"
    >
      <IconTrash :size="14" class="btn-icon" />
      <span class="btn-text">
        <ConfirmLabel :armed="armed !== null" :label="i18n.t('app.clear')" />
      </span>
    </button>
    <span
      v-if="trayOpen"
      ref="trayRef"
      class="side-tray"
      :style="{ '--panel-shift': `${trayShift}px` }"
      @focusin="trayFocused = true"
      @focusout="onTrayFocusOut"
    >
      <button
        v-for="side in sides"
        :key="side.team"
        type="button"
        class="side-choice"
        :class="side.team === Team.ALLY ? 'ally' : 'enemy'"
        :disabled="side.disabled"
        @click="pickSide(side.team)"
      >
        <span class="side-dot" />
        {{ i18n.t(teamLabelKey(side.team)) }}
      </button>
    </span>
  </span>
</template>

<style scoped>
.clear-control {
  position: relative;
  display: inline-flex;
}

.side-tray {
  position: absolute;
  top: calc(100% + var(--spacing-sm));
  left: 50%;
  transform: translateX(calc(-50% + var(--panel-shift, 0px)));
  z-index: var(--z-dropdown);
  display: flex;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs);
  background: var(--color-bg-primary);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  box-shadow: var(--shadow-float);
}

.side-choice {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: var(--spacing-xs) var(--spacing-md);
  border: var(--chip-border) solid var(--color-danger-text);
  border-radius: 999px;
  background: transparent;
  color: var(--color-danger-text);
  font-size: var(--chip-font-size);
  font-weight: var(--control-font-weight);
  white-space: nowrap;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.side-choice:hover:not(:disabled) {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: #fff;
}

.side-choice:disabled {
  opacity: 0.4;
  cursor: default;
}

.side-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ally .side-dot {
  background: var(--color-ally);
}

.enemy .side-dot {
  background: var(--color-enemy);
}

.side-choice:hover:not(:disabled) .side-dot {
  box-shadow: 0 0 0 1.5px #fff;
}
</style>
