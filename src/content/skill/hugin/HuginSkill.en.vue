<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Hugin · Skills',
  description:
    "Hugin forges a Gear of Might for the ally dealing the highest cumulative damage, boosting their combat strength. The gear increases the ally's ATK by 6% of Hugin's base ATK and increases their Haste by 80 for 10s.",
  url: 'skill/hugin',
  locale: 'en',
  keywords: ['Hugin', '呼金'],
})
</script>

<template>
  <article>
    <h1>Hugin</h1>

    <h2>Non-Permanent Buff</h2>

    <h3>Ultimate</h3>
    <p>
      <strong>Active.</strong> Hugin forges a Gear of Might for the ally dealing the highest
      cumulative damage, boosting their combat strength. The gear increases the ally's ATK by 6% of
      Hugin's base ATK and increases their Haste by 80 for 10s.
    </p>

    <h3>Skill</h3>
    <p>Hugin crafts a cogshield for the weakest ally, allowing them to block 600% damage for 8s.</p>

    <h3>EX Skill</h3>
    <p>
      Hugin crafts enhanced cogshields for the 2 weakest allies when casting Unstoppable!, granting
      each with a shield that blocks 800% damage for 8s.
    </p>
  </article>
</template>
