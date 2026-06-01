<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Frieren.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          The grid is organized into horizontal rows, with row 15 (hexes 44, 45) being the rearmost
          position for the enemy team, and row 1 (hexes 1, 2) being the rearmost for the ally team.
        </p>
        <p>
          Within the same row, leftmost (higher hex IDs) tiles are considered "further in front" on
          the ally side, while rightmost (lower hex IDs) tiles are "further in front" on the enemy
          side.
        </p>
        <p>The frontmost character is determined by their position on the hexagonal grid:</p>
        <ul>
          <li>
            <strong>Ally Team Frieren:</strong> Scans ally positions starting from the frontmost
            row, from left to right (highest tile ID to lowest), targeting the first teammate found.
          </li>
          <li>
            <strong>Enemy Team Frieren:</strong> Scans enemy positions in reverse order, from right
            to left (lowest tile ID to highest), targeting the first teammate found.
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
