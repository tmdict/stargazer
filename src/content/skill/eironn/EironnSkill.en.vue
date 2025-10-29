<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Eironn · Skills',
  description:
    'Eironn casts Verdant Cyclone for the first time in each battle without consuming Energy, but the damage is reduced to 50% of the original.',
  url: 'skill/eironn',
  locale: 'en',
  keywords: ['Eironn', '埃隆', '绿剑'],
})
</script>

<template>
  <article>
    <h1>Eironn</h1>

    <h2>Instant Ultimate</h2>

    <h3>Ultimate</h3>
    <p>
      Eironn combines the power of two swords and selects a tile, pulling in enemies within 2 tiles
      to the center. Then causes an explosion after a short delay, dealing 250% damage to enemies
      within 2 tiles and immobilizing them for 3s.
    </p>

    <h3>EX Skill</h3>
    <p>
      Eironn casts Verdant Cyclone for the first time in each battle without consuming Energy, but
      the damage is reduced to 50% of the original.
    </p>
  </article>
</template>
