<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Talene.data'

setupSkillContentMeta('talene', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Talene</h1>

      <h2>Targeting Mechanics</h2>

      <h3>EX Skill</h3>
      <p>
        Talene grants Pyre of Renewal to the [[frontmost]] allied hero other than herself from the
        beginning of the battle until the end. Pyre of Renewal carrier will deal damage equal to
        [[50%]] of their ATK per second to adjacent enemies and restore HP equal to [[25%]] of their
        damage dealt. Every time the carrier is healed by an amount equal to [[500%]] of their ATK,
        a kindling will be generated next to them to permanently enhance Talene's Pyre of Renewal,
        increasing its damage dealt by [[50%]] for up to [[3]] stacks.
      </p>
      <p>
        <strong>Level 4:</strong> When Pyre of Renewal reaches the maximum number of stacks and its
        carrier is defeated, all stacks will be consumed to transform the carrier into a ball of
        flame. The carrier will then resurrect in [[3]]s with [[50%]] of their max HP. This effect
        can only be triggered once in each battle.
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
          <strong>Ally Team Talene:</strong> Scans ally positions starting from the frontmost row,
          from left to right (highest tile ID to lowest), targeting the first ally found.
        </li>
        <li>
          <strong>Enemy Team Talene:</strong> Scans enemy positions in reverse orer, from right to
          left (lowest tile ID to highest), targeting the first ally found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
