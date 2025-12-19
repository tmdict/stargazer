<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Perseus · Skills',
  description:
    'Before Perseus takes heavy damage, the ground within 1 tile around him turns fertile. Allies standing on this fertile ground have their ATK increased by 14% and Phys & Magic DEF increased by 19%.',
  url: 'skill/perseus',
  locale: 'en',
  keywords: ['Perseus', '珀尔修斯', '人皇'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Perseus</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Before Perseus takes heavy damage, the ground within 1 tile around him turns fertile. Allies
        standing on this fertile ground have their ATK increased by [[14%]] and Phys & Magic DEF
        increased by [[19%]].
      </p>
    </article>
  </StyledText>
</template>
