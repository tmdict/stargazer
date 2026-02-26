<script setup lang="ts">
import { computed } from 'vue'

import { Grid } from '@/lib/grid'
import { Layout, POINTY } from '@/lib/layout'
import { getMapByKey, getMapNames, type MapConfig } from '@/lib/maps'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const gridStore = useGridStore()

const emit = defineEmits<{
  arenaSelected: [mapKey: string]
}>()

const SIZE = 170
const HEX_SIZE = 10

const layout = new Layout(POINTY, { x: HEX_SIZE, y: HEX_SIZE }, { x: SIZE / 2, y: SIZE / 2 })

const arenas = computed(() => {
  return getMapNames().map(({ key, name }) => {
    const config = getMapByKey(key)!
    const grid = new Grid(FULL_GRID, config)
    const tiles = grid.getAllTiles().map((tile) => ({
      points: layout
        .polygonCorners(tile.hex)
        .map((p) => `${p.x},${p.y}`)
        .join(' '),
      fill: getTileFill(tile.state),
    }))
    return { key, name, tiles }
  })
})

function getTileFill(state: State): string {
  switch (state) {
    case State.AVAILABLE_ALLY:
      return 'rgba(54, 149, 142, 0.35)'
    case State.AVAILABLE_ENEMY:
      return 'rgba(200, 35, 51, 0.35)'
    case State.BLOCKED:
      return 'rgba(128, 128, 128, 0.45)'
    case State.BLOCKED_BREAKABLE:
      return 'rgba(128, 128, 128, 0.28)'
    default:
      return 'rgba(255, 255, 255, 0.08)'
  }
}

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
        <svg :width="SIZE" :height="SIZE" :viewBox="`0 0 ${SIZE} ${SIZE}`">
          <polygon
            v-for="(tile, index) in arena.tiles"
            :key="index"
            :points="tile.points"
            :fill="tile.fill"
            stroke="rgba(0, 0, 0, 0.1)"
            stroke-width="1"
          />
        </svg>
        <span class="arena-name">{{ `${i18n.t('app.arena')} ${arena.name}` }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.arena-preset-grid {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

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

.arena-name {
  font-weight: 600;
  color: #374151;
  font-size: 0.8rem;
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.02em;
}
</style>
