<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './FaramorSkill.data'

setupSkillContentMeta('faramor', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Faramor</h1>

      <h2>Non-Permanent Buff (Instant) · Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> During battle preparation, Faramor can bless an adjacent allied
        hero, prioritizing those placed behind him.
      </p>
      <p>
        <strong>Active.</strong> Faramor increases ATK by [[12%]] for [[10]]s for both himself and
        the hero he blesses, automatically reapplying the buff when it expires.
      </p>

      <strong>How It Works</strong>
      <p>
        Faramor looks for ally characters on tiles adjacent to him, prioritizing characters in the
        back. When multiple characters are in the same row, Faramor will prioritize the character to
        the right (lower hex ID):
      </p>
      <p>When on enemy team, Faramor prioritize teammates with the higher hex ID (180° rotation)</p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
