<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('parisa', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Parisa</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Parisa increases ATK SPD by [[22]] and normal attack damage by [[22%]] for [[10]]s for
        herself and [[1]] nearest ally.
      </p>
    </article>
  </StyledText>
</template>
