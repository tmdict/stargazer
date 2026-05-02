<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Frieren.data'

setupSkillContentMeta('frieren', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Frieren</h1>

      <h2>Targeting Mechanics</h2>

      <h3>EX Skill</h3>
      <p>
        When a battle starts, Frieren casts defensive magic on herself and the [[frontmost]] ally.
        When either takes damage exceeding [[10%]] of their initial max HP, the excess damage is
        reduced by [[75%]].
      </p>
      <p>
        <strong>Level 3:</strong> While the [[frontmost]] ally remains alive, Frieren increases her
        Haste by [[35]].
      </p>

      <strong>How It Works</strong>
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
          <strong>Ally Team Frieren:</strong> Scans ally positions starting from the frontmost row,
          from left to right (highest tile ID to lowest), targeting the first ally found.
        </li>
        <li>
          <strong>Enemy Team Frieren:</strong> Scans enemy positions in reverse orer, from right to
          left (lowest tile ID to highest), targeting the first ally found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
