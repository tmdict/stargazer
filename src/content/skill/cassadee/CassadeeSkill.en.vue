<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './CassadeeSkill.data'

setupSkillContentMeta('cassadee', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Cassadee</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Cassadee selects the nearest ally when a battle starts (prioritizing the ally behind
        herself), granting them the blessing of Tidal Strength. She deals extra [[60%]] magic damage
        to the enemy once when the blessed ally hits them with normal attacks. The blessing vanishes
        after this effect is triggered [[9]] times. Cassadee will bless this ally again after
        [[9]]s. This effect can't be dispelled.
      </p>

      <strong>How It Works</strong>
      <p>
        Cassadee looks for ally characters starting from tiles adjacent to her and expanding
        outwards, prioritizing characters in the back. When multiple characters are in the same row,
        Cassadee will prioritize the character to the right (lower hex ID):
      </p>
      <ul>
        <li>
          <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from rearmost row to
          frontmost row, and right to left (lower hex ID).
        </li>
        <li>
          <strong>Ring 2:</strong> 12 tiles at distance 2, starting from rearmost row to frontmost
          row, and right to left (lower hex ID).
        </li>
        <li>And so on...</li>
      </ul>
      <p>
        When on enemy team, Cassadee prioritize teammates with the higher hex ID (180° rotation)
      </p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
