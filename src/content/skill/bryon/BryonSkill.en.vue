<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Bryon · Skills',
  description:
    'When a battle starts, Bryon gains 1000 Initial Energy and summons his falcon Elona.',
  url: 'skill/bryon',
  locale: 'en',
  keywords: ['Bryon', '布莱恩', '鸟人'],
})
</script>

<template>
  <article>
    <h1>Bryon</h1>

    <h2>Instant Ultimate</h2>

    <h3>Ultimate</h3>
    <p>
      Passive. When a battle starts, Bryon gains 1000 Initial Energy and summons his falcon Elona.
    </p>
    <p>
      Active. Bryon consumes 300 Energy, calling Elona to deal 320% damage to his current target.
      Elona remains on the battlefield, consuming increasing amounts of Energy over time. When she
      runs out of Energy or Bryon is defeated, Elona leaves the battlefield.
    </p>
  </article>
</template>
