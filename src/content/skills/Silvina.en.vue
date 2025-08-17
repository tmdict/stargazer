<template>
  <article>
    <h1>Silvina - First Strike</h1>
    <p>
      Silvina marks the closest enemy in a symmetrical position, flashes next to them, and launches
      an attack when a battle starts.
    </p>

    <h2>How It Works</h2>
    <p>
      Silvina first checks her symmetrical tile (the mirror position across the grid's center). If
      an enemy is there, they become the target.
    </p>
    <p>
      If the symmetrical tile is empty, Silvina searches for the nearest enemy to that position
      using an expanding clockwise spiral pattern:
    </p>
    <ul>
      <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
      <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
      <li>And so on...</li>
    </ul>

    <GridSnippet :gridStyle="gridStyles.main" />

    <p>
      Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally) walks
      counter-clockwise from bottom-left (180° rotation).
    </p>
    <p>(Credit: rkkñ for documenting Silvina's targeting mechanics)</p>
  </article>
</template>

<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { gridStyles } from './Silvina.data'
</script>
