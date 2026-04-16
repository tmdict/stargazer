<template>
  <div class="pick-slots-container">
    <div class="pick-slots">
      <div
        :class="[
          'team',
          'team-left',
          { 'active-side': currentPickSide === 'left' || currentPickSide === null },
        ]"
      >
        <span class="side-indicator" :class="{ visible: currentPickSide === 'left' }">
          ▶ Picking
        </span>
        <div class="team-slots">
          <div
            v-for="(hero, i) in pickState.left"
            :key="'l' + i"
            :class="['pick-slot', { filled: !!hero }]"
            @click="hero ? emit('unpickSlot', 'left', i) : undefined"
          >
            <CharacterIcon
              v-if="hero && getCharacter(hero)"
              :character="getCharacter(hero)!"
              :hide-info="true"
              :show-simple-tooltip="true"
            />
            <span v-else class="slot-label">{{ draftOrderFor('left', i) }}</span>
          </div>
        </div>
      </div>

      <span class="vs-label">vs</span>

      <div
        :class="[
          'team',
          'team-right',
          { 'active-side': currentPickSide === 'right' || currentPickSide === null },
        ]"
      >
        <span class="side-indicator enemy" :class="{ visible: currentPickSide === 'right' }">
          Picking ◀
        </span>
        <div class="team-slots">
          <div
            v-for="(hero, i) in pickState.right"
            :key="'r' + i"
            :class="['pick-slot', 'enemy', { filled: !!hero }]"
            @click="hero ? emit('unpickSlot', 'right', i) : undefined"
          >
            <CharacterIcon
              v-if="hero && getCharacter(hero)"
              :character="getCharacter(hero)!"
              :hide-info="true"
              :show-simple-tooltip="true"
            />
            <span v-else class="slot-label">{{ draftOrderFor('right', i) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import CharacterIcon from '@/components/CharacterIcon.vue'
import type { CharacterType } from '@/lib/types/character'
import { DRAFT_ORDER } from '@/wandwars/constants'
import type { PickSide, PickState } from '@/wandwars/types'

const props = defineProps<{
  pickState: PickState
  characters: readonly CharacterType[]
  currentPickSide?: PickSide | null
}>()

const emit = defineEmits<{
  unpickSlot: [side: PickSide, slot: number]
}>()

function getCharacter(name: string): CharacterType | undefined {
  return props.characters.find((c) => c.name === name)
}

function draftOrderFor(side: PickSide, slot: number): number {
  const idx = DRAFT_ORDER.findIndex(([s, n]) => s === side && n === slot)
  return idx >= 0 ? idx + 1 : 0
}
</script>

<style scoped>
.pick-slots-container {
  container-type: inline-size;
  margin-bottom: var(--spacing-lg);
}

.pick-slots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
}

.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  opacity: 0.6;
  transition: opacity var(--transition-fast);
}

.team.active-side {
  opacity: 1;
}

.team-slots {
  display: flex;
  gap: var(--spacing-sm);
}

.side-indicator {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-ally);
  visibility: hidden;
  white-space: nowrap;
}

.side-indicator.enemy {
  color: var(--color-enemy);
}

.side-indicator.visible {
  visibility: visible;
}

.pick-slot {
  width: 70px;
  height: 70px;
  border-radius: var(--radius-round);
  border: 2px dashed var(--color-ally);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-white);
  cursor: default;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.pick-slot.enemy {
  border-color: var(--color-enemy);
}

.pick-slot.filled {
  border-style: solid;
  border-color: transparent;
  cursor: pointer;
}

.pick-slot.filled:hover {
  opacity: 0.8;
}

.slot-label {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.vs-label {
  font-size: 1rem;
  font-weight: bold;
  color: var(--color-text-secondary);
  margin-top: var(--spacing-lg);
}

@container (max-width: 450px) {
  .pick-slots {
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--spacing-sm);
  }

  .vs-label {
    width: 100%;
    text-align: center;
    margin-top: 0;
  }

  .pick-slot {
    width: 60px;
    height: 60px;
  }
}

@container (max-width: 320px) {
  .pick-slot {
    width: 50px;
    height: 50px;
  }
}
</style>
