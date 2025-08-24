<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'

import { gridStyles, images } from './NaraSkill.data'

setupContentMeta({
  title: 'Nara · Phantom Chains',
  description:
    "Nara pulls a distant enemy hero toward her when there are no enemies within her normal attack range. This skill won't defeat the enemy and prioritizes attacking the closest symmetrical enemy hero.",
  url: 'skill/nara',
  locale: 'en',
  keywords: ['Nara', '奈拉'],
})
</script>

<template>
  <article>
    <h1>Nara · Phantom Chains</h1>
    <p>
      Nara pulls a distant enemy hero toward her when there are no enemies within her normal attack
      range. This skill won't defeat the enemy and prioritizes attacking the closest symmetrical
      enemy hero.
    </p>

    <h2>How It Works</h2>
    <p>
      Nara first checks her symmetrical tile (the mirror position across the grid's center). If an
      enemy is there, they become the target.
    </p>
    <p>
      If the symmetrical tile is empty, Nara searches for the nearest enemy in a clockwise spiral
      expanding from that tile's position:
    </p>
    <ul>
      <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
      <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
      <li>And so on...</li>
    </ul>

    <GridSnippet :grid-style="gridStyles.main" :images />

    <p>
      Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally) walks
      counter-clockwise from bottom-left (180° rotation).
    </p>
  </article>
</template>
