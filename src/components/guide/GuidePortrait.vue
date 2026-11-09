<script setup lang="ts">
/* A hero's portrait on its tier backdrop for the guide pages; CharacterIcon
   is the draggable picker tile and far heavier than these lists need. */

import { computed } from 'vue'

import GuideDisc from './GuideDisc.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { curatedHeroName } from '@/utils/skillLabels'

const { slug, lang, size } = defineProps<{ slug: string; lang: AppLocale; size?: number }>()

const gameData = useGameDataStore()

const level = computed(() => gameData.characters.find((c) => c.name === slug)?.level ?? 'a')
</script>

<template>
  <GuideDisc :size :backdrop="gameData.getIcon(`bg-${level}`)" :title="curatedHeroName(slug, lang)">
    <img :src="gameData.getCharacterImage(slug)" alt="" />
  </GuideDisc>
</template>
