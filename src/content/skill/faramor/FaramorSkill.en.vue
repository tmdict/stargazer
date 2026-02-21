<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

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
    </article>
  </StyledText>
</template>
