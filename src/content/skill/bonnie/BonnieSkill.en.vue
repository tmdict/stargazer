<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './BonnieSkill.data'

setupContentMeta({
  title: 'Bonnie · Skills',
  description:
    'When a battle starts, Bonnie casts the Aging magic on the rearmost enemy, dealing 150% damage and reducing their Haste by 30 until the battle ends. Bonnie prioritizes attacking this target afflicted by Aging.',
  url: 'skill/bonnie',
  locale: 'en',
  keywords: ['Bonnie', '波妮'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Bonnie</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Bonnie casts the Aging magic on the rearmost enemy, dealing [[150%]]
        damage and reducing their Haste by [[30]] until the battle ends. Bonnie prioritizes
        attacking this target afflicted by Aging.
      </p>

      <strong>How It Works</strong>
      <p>
        The grid is organized into horizontal rows, with row 15 (hexes 44, 45) being the rearmost
        position for the enemy team, and row 1 (hexes 1, 2) being the rearmost for the ally team.
      </p>
      <p>
        Within the same row, leftmost (higher hex IDs) tiles are considered "further back" on the
        enemy side, while rightmost (lower hex IDs) tiles are "further back" on the ally side.
      </p>
      <p>The rearmost character is determined by their position on the hexagonal grid:</p>
      <ul>
        <li>
          <strong>Ally Team Bonnie:</strong> Scans enemy positions starting from the rearmost row,
          from left to right (highest tile ID to lowest), targeting the first enemy found.
        </li>
        <li>
          <strong>Enemy Team Bonnie:</strong> Scans ally positions in reverse orer, from right to
          left (lowest tile ID to highest), targeting the first ally found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
