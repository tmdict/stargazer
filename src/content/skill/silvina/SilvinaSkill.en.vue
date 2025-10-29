<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './SilvinaSkill.data'

setupContentMeta({
  title: 'Silvina · Skills',
  description:
    'Silvina marks the closest enemy in a symmetrical position, flashes next to them, and launches an attack when a battle starts, dealing 300% damage.',
  url: 'skill/silvina',
  locale: 'en',
  keywords: ['Silvina', '西尔维娜', '苍白'],
})
</script>

<template>
  <article>
    <h1>Silvina</h1>

    <h2>Targeting Mechanics</h2>

    <h3>Skill</h3>
    <p>
      Silvina marks the closest enemy in a symmetrical position, flashes next to them, and launches
      an attack when a battle starts, dealing 300% damage.
    </p>

    <h3>How It Works</h3>

    <p>
      Silvina first checks her symmetrical tile (the mirror position across the grid's center). If
      an enemy is there, they become the target.
    </p>
    <p>
      If the symmetrical tile is empty, Silvina searches for the nearest enemy in a clockwise spiral
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
    <p>(Credit: rkkñ for documenting Silvina's targeting mechanics)</p>
  </article>
</template>
