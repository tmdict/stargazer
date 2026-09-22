<script setup lang="ts">
/* Small portrait disc (roster ring and tier backdrop) for the guide index's
   chips, ladder rows and mechanic tiles; CharacterIcon is the draggable
   roster tile and far heavier than these lists need. */

import { computed } from 'vue'

import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { curatedHeroName } from '@/utils/skillLabels'

// Without `size` the disc takes `--size` from its host's stylesheet (or the
// 28px default), so a host can resize its portraits in a container query.
const { slug, lang, size } = defineProps<{ slug: string; lang: AppLocale; size?: number }>()

const gameData = useGameDataStore()

const level = computed(() => gameData.characters.find((c) => c.name === slug)?.level ?? 'a')
</script>

<template>
  <span
    class="disc"
    :style="{
      '--size': size ? `${size}px` : undefined,
      backgroundImage: `url(${gameData.getIcon(`bg-${level}`)})`,
    }"
    :title="curatedHeroName(slug, lang)"
  >
    <img :src="gameData.getCharacterImage(slug)" alt="" />
  </span>
</template>

<style scoped>
.disc {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--size, 28px);
  height: var(--size, 28px);
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 2px #fff;
  background-size: cover;
  background-position: center;
}
.disc::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff4;
}
.disc img {
  position: relative;
  z-index: 1;
  width: calc(var(--size, 28px) + 5px);
  height: calc(var(--size, 28px) + 5px);
  object-fit: cover;
}
</style>
