<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './RavionSkill.data'

setupContentMeta({
  title: 'Ravion · Skills',
  description:
    "When a battle starts, Ravion assigns an Objective to each of the 2 rearmost allies. Allies complete their objective by either dealing damage equal to 2000% of Ravion's initial ATK or assisting or defeating an enemy. Upon completion, the ally recovers 150 Energy and increases their ATK by 12% of Ravion's initial ATK for 30s.",
  url: 'skill/ravion',
  locale: 'en',
  keywords: ['Ravion', '沙利叶'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Ravion</h1>

      <h2>Instant Buff · Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Ravion assigns an Objective to each of the [[2 rearmost]] allies.
        Allies complete their objective by either dealing damage equal to [[2000%]] of Ravion's
        initial ATK or [[assisting or defeating]] an enemy. Upon completion, the ally recovers
        [[150]] Energy and increases their ATK by [[12%]] of Ravion's initial ATK for [[30]]s.
      </p>

      <h3>Enhance Force</h3>
      <p>
        When an ally accepts the Objective from Ravion, they increase their ATK by [[15%]] and
        become [[unaffected]]. These effects last for [[5]]s.
      </p>

      <h2>Targeting Mechanics</h2>

      <h3>How It Works</h3>
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
          <strong>Ally Team Ravion:</strong> Scans ally positions starting from the rearmost row,
          from right to left (lowest tile ID to highest), targeting the first 2 allies found.
        </li>
        <li>
          <strong>Enemy Team Ravion:</strong> Scans enemy positions in reverse orer, from left to
          right (highest tile ID to lowest), targeting the first 2 enemies found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
