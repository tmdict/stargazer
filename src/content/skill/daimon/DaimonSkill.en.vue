<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './DaimonSkill.data'

setupSkillContentMeta('daimon', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Daimon</h1>

      <h2>Non-Permanent Buff · Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Daimon forms a bond with the ally placed behind him during battle preparation. Whenever
        Daimon gains a shield, the bonded ally also receives [[24%]] of that shield for the same
        duration. While shielded by Daimon, the bonded ally gains an extra [[15]] Life Drain and
        [[25%]] ATK. If the bonded ally is defeated, Daimon will immediately bond with the
        [[weakest]] ally.
      </p>

      <strong>How It Works</strong>
      <p>
        Daimon looks for ally characters on tiles immediately behind him, when multiple characters
        are in the same row, Daimon will prioritize the character to the left (higher hex ID).
      </p>
      <p>When on enemy team, Daimon prioritize teammates with the lower hex ID (180° rotation).</p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
