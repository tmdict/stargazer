<script setup lang="ts">
import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import IconFill from '@/components/ui/IconFill.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { State } from '@/lib/types/state'
import { appLabel } from '@/utils/skillLabels'
import { getTileFillColor } from '@/utils/tileStateFormatting'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)

const TILE_TYPES = [
  { state: State.DEFAULT, key: 'empty' },
  { state: State.AVAILABLE_ALLY, key: 'ally-tile' },
  { state: State.AVAILABLE_ENEMY, key: 'enemy-tile' },
  { state: State.BLOCKED, key: 'blocked' },
  { state: State.BLOCKED_BREAKABLE, key: 'breakable' },
]

const PAINT = [
  { at: [1, 1] as const, state: State.BLOCKED },
  { at: [1, 2] as const, state: State.BLOCKED },
  { at: [1, 3] as const, state: State.BLOCKED_BREAKABLE },
  { at: [0, 4] as const, state: State.BLOCKED },
]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('maps')">
        <div class="help-mock-bar centered">
          <HelpToggle :label="label('edit-tiles')" on />
        </div>
        <div class="help-tile-types">
          <span
            v-for="type in TILE_TYPES"
            :key="type.state"
            class="help-tile-type"
            :class="{ on: type.state === State.BLOCKED }"
          >
            <svg viewBox="0 0 32 32" width="26" height="26">
              <polygon
                points="16,2 28,9 28,23 16,30 4,23 4,9"
                :fill="getTileFillColor(type.state)"
                stroke="#888"
                stroke-width="2"
              />
            </svg>
            {{ label(type.key) }}
          </span>
        </div>
        <div class="help-mock-bar centered">
          <span class="help-editor-btn"><IconFill :size="13" />{{ label('fill') }}</span>
          <span class="help-editor-btn danger">{{ label('clear') }}</span>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('arena')">
        <HelpBoard
          class="help-maps-board"
          :paint="PAINT"
          :tokens="[{ slug: 'valen', at: [2, 2] }]"
        />
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
/* Copy of MapEditor's tile type buttons, smaller. */
.help-tile-types {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
  margin-bottom: 12px;
}

.help-tile-type {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 56px;
  padding: 6px 4px;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
}

.help-tile-type.on {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
}

/* Copy of MapEditor's Fill and Clear, which keep their text on phones. */
.help-editor-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-medium);
  background: var(--color-primary);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
}

.help-editor-btn.danger {
  background: #c05b4d;
}

.help-maps-board {
  width: 210px;
  margin: 22px auto 0;
}
</style>
