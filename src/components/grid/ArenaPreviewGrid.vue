<script setup lang="ts">
import { computed } from 'vue'

import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { getMapNames } from '@/lib/maps'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const gridStore = useGridStore()

const emit = defineEmits<{
  arenaSelected: [mapKey: string]
}>()

// The maps tab's square framing: the board centered in a 170px viewBox.
const SIZE = 170
const HEX_SIZE = 10

const arenas = computed(() =>
  getMapNames().map(({ key, name }) => ({
    key,
    name,
    labelKey: key.startsWith('preset') ? 'app.preset' : 'app.arena',
  })),
)

const handleArenaClick = (mapKey: string) => {
  emit('arenaSelected', mapKey)
}
</script>

<template>
  <div class="arena-preset-grid">
    <div class="arena-presets">
      <button
        v-for="arena in arenas"
        :key="arena.key"
        class="arena-thumbnail"
        :class="{ active: gridStore.currentMap === arena.key }"
        @click="handleArenaClick(arena.key)"
      >
        <BoardThumbnail
          class="arena-svg"
          :map-key="arena.key"
          :hex-size="HEX_SIZE"
          :view-box-size="SIZE"
        />
        <span class="arena-name">{{ `${i18n.t(arena.labelKey)} ${arena.name}` }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.arena-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: center;
}

.arena-thumbnail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.06);
  border: 1.5px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.arena-thumbnail:hover {
  background: rgba(0, 0, 0, 0.1);
  border-color: rgba(0, 0, 0, 0.2);
  transform: translateY(-1px);
}

.arena-thumbnail.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.08);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.arena-svg {
  width: 170px;
  height: 170px;
}

.arena-name {
  font-weight: 600;
  color: #374151;
  font-size: 0.8rem;
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

@media (max-width: 768px) {
  .arena-thumbnail {
    width: calc(50% - 0.25rem);
  }

  .arena-svg {
    width: 100%;
    height: auto;
  }
}
</style>
