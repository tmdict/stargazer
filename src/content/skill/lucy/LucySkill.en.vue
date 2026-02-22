<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lucy', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Lucy</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        Lucy calls out Aquarius, a Celestial Spirit, to assist her in battle. Aquarius has [[120%]]
        of Lucy's max HP and 100% of Lucy's other stats. Upon entering battle, Aquarius conjures a
        water swirl that strikes the 1-tile area with the most enemies, dealing [[300%]] damage to
        all enemies in the area. The affected enemies are knocked into the air and stunned for
        [[2]]s. The water swirl attack repeats every [[10]]s. Aquarius' normal attack deals [[100%]]
        damage with a range of [[10]] tiles.
      </p>
    </article>
  </StyledText>
</template>
