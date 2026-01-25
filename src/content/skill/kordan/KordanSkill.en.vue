<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Kordan · Skills',
  description:
    'When casting this skill, Kordan raises his blade and challenges 1 enemy within 1 tile, immobilizing the target for 5s. At the same time, he summons a hunting circle around him and his target, dealing 180% damage to all enemies within the circle and knocking back other ranged enemies out of the circle.',
  url: 'skill/kordan',
  locale: 'en',
  keywords: ['Kordan', '戈丹'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Kordan</h1>

      <h2>Instant Ultimate</h2>

      <h3>Ultimate</h3>
      <p>
        When casting this skill, Kordan raises his blade and challenges [[1]] enemy within [[1]]
        tile, immobilizing the target for [[5]]s. At the same time, he summons a hunting circle
        around him and his target, dealing [[180%]] damage to all enemies within the circle and
        knocking back other ranged enemies out of the circle.
      </p>
    </article>
  </StyledText>
</template>
