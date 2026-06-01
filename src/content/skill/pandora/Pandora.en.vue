<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Pandora.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="mechanic-targeting">
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
            <strong>Ally Team Pandora:</strong> Scans ally positions starting from the rearmost row,
            from right to left (lowest tile ID to highest), targeting the first teammate found.
          </li>
          <li>
            <strong>Enemy Team Pandora:</strong> Scans enemy positions in reverse order, from left
            to right (highest tile ID to lowest), targeting the first teammate found.
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
