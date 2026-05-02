<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('pippa', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Pippa</h1>

      <h2>Energy Reduction</h2>

      <h3>Skill</h3>
      <p>
        Pippa summons magical plants in the area with the most enemies. The plants cover a 1-tile
        area and persist for 3s. Every second, the plants deal [[140%]] damage to enemies within and
        reduce their Energy by [[150]].
      </p>
      <p>If this skill goes out of control, the plants last only 1s, drifting like a moonflower.</p>
    </article>
  </StyledText>
</template>
