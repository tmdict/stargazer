<script setup lang="ts">
/* A hero portrait under a generated set's board, sized by its host's --pt, and
   titled with the hero's name unless a card names it. */

import { computed } from 'vue'

import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { curatedHeroName } from '@/utils/skillLabels'

const { id, titled = true } = defineProps<{ id: number; titled?: boolean }>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const slug = computed(() => gameData.getCharacterNameById(id) ?? '')
</script>

<template>
  <span class="pt" :title="titled ? curatedHeroName(slug, i18n.currentLocale) : undefined">
    <img :src="gameData.getCharacterImage(slug)" alt="" />
  </span>
</template>

<style scoped>
.pt {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--pt, 40px);
  height: var(--pt, 40px);
  border-radius: 50%;
  border: 1px solid var(--color-border-light);
  background: #555;
  overflow: hidden;
}

.pt img {
  width: calc(var(--pt, 40px) + 5px);
  height: calc(var(--pt, 40px) + 5px);
  object-fit: cover;
}
</style>
