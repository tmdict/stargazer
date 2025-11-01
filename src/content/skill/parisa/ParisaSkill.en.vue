<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Parisa · Skills',
  description:
    'Parisa increases ATK SPD by 22 and normal attack damage by 22% for 10s for herself and 1 nearest ally.',
  url: 'skill/parisa',
  locale: 'en',
  keywords: ['Parisa', '帕瑞莎', '花女'],
})
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
