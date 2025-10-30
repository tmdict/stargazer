<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Aliceth · Skills',
  description:
    'Passive. Aliceth grants an ally Brightfeather, prioritizing the nearest ally in her row. After that ally deals ranged damage 3 times, they unleash a feather for an additional strike, dealing 120% damage. This extra strike can trigger once every 0.5s.',
  url: 'skill/aliceth',
  locale: 'en',
  keywords: ['Aliceth', '亚莉克希', '弓神'],
})
</script>

<template>
  <article>
    <h1>Aliceth</h1>

    <h2>Targeting Mechanics</h2>

    <h3>Skill</h3>
    <p>
      Passive. Aliceth grants an ally Brightfeather, prioritizing the nearest ally in her row. After
      that ally deals ranged damage 3 times, they unleash a feather for an additional strike,
      dealing 120% damage. This extra strike can trigger once every 0.5s.
    </p>
    <p>
      If the ally granted Brightfeather is a ranged unit, their normal attack range is increased by
      5 tiles. The ally loses Brightfeather if they are defeated.
    </p>
    <p>
      When a battle starts, Aliceth places her Mark of Judgment on the farthest enemy. She and
      allies with Brightfeather both prioritize attacking the marked enemy, and their attacks
      against that enemy gain an extra 35 Penetration.
    </p>
  </article>
</template>
