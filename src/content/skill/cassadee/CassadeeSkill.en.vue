<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

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
    </article>
  </StyledText>
</template>
