<template>
  <div class="hero-grid-container">
    <div class="controls-row">
      <FilterIcons icon-prefix="faction" :options="factionOptions" v-model="factionFilter" />
      <div class="actions">
        <slot name="actions" />
      </div>
    </div>

    <div class="hero-grid">
      <button
        v-for="char in filteredCharacters"
        :key="char.name"
        :class="['hero-btn', { unavailable: !isAvailable(char.name) }]"
        :disabled="!isAvailable(char.name)"
        @click="emit('pickHero', char.name)"
      >
        <div
          class="hero-portrait"
          :style="{
            background: `url(${getIcon(`bg-${char.level}`)}) center/cover`,
          }"
        >
          <img
            v-if="characterImages[char.name]"
            :src="characterImages[char.name]"
            :alt="char.name"
            class="portrait-img"
          />
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import FilterIcons from '@/components/ui/FilterIcons.vue'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'

const props = defineProps<{
  characters: readonly CharacterType[]
  availableHeroes: string[]
  characterImages: Record<string, string>
}>()

const emit = defineEmits<{ pickHero: [hero: string] }>()

const gameDataStore = useGameDataStore()
const { getIcon } = gameDataStore

const factionFilter = ref('')

const factionOptions = computed(() => {
  const factions = [...new Set(props.characters.map((c) => c.faction))]
  return factions.sort()
})

const filteredCharacters = computed(() => {
  let filtered = [...props.characters]

  if (factionFilter.value) {
    filtered = filtered.filter((c) => c.faction === factionFilter.value)
  }

  const levelOrder: Record<string, number> = { s: 0, a: 1, rare: 2 }
  return filtered.sort(
    (a, b) =>
      (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9) ||
      a.faction.localeCompare(b.faction) ||
      a.name.localeCompare(b.name),
  )
})

function isAvailable(hero: string): boolean {
  return props.availableHeroes.includes(hero)
}
</script>

<style scoped>
.hero-grid-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  margin-top: var(--spacing-md);
}

.controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  padding: 0 var(--spacing-sm);
}

.actions {
  display: flex;
  gap: var(--spacing-sm);
}

.hero-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  justify-content: flex-start;
  align-content: flex-start;
  padding: var(--spacing-sm);
}

.hero-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    opacity var(--transition-fast);
}

.hero-btn:hover:not(.unavailable) {
  transform: scale(1.05);
}

.hero-btn.unavailable {
  opacity: 0.25;
  cursor: not-allowed;
}

.hero-portrait {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 4px #fff;
}

.hero-portrait::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff4;
}

.portrait-img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  z-index: 1;
}

@media (max-width: 768px) {
  .hero-portrait {
    width: 60px;
    height: 60px;
  }

  .portrait-img {
    width: 68px;
    height: 68px;
  }
}

@media (max-width: 480px) {
  .hero-grid {
    gap: var(--spacing-md);
    justify-content: center;
  }

  .hero-portrait {
    width: 50px;
    height: 50px;
    box-shadow: 0 0 0 3px #fff;
  }

  .portrait-img {
    width: 56px;
    height: 56px;
  }
}
</style>
