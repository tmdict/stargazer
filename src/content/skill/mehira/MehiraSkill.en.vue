<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Mehira · Skills',
  description:
    'Mehira lashes her whip at all units, friend or foe, in a 3-frontal arc 5 times. Each hit causes a unit to lose 20% HP. If an allied unit is hit, they gain 25 Haste for 8s per hit, and their HP loss from this skill is reduced by 90%. Mehira always targets the direction that hits the most enemies.',
  url: 'skill/mehira',
  locale: 'en',
  keywords: ['Mehira', '梅希拉', '魅魔'],
})
</script>

<template>
  <article>
    <h1>Mehira</h1>

    <h2>Non-Permanent Buff</h2>

    <h3>Skill</h3>
    <p>
      Mehira lashes her whip at all units, friend or foe, in a 3-frontal arc 5 times. Each hit
      causes a unit to lose 20% HP. If an allied unit is hit, they gain 25 Haste for 8s per hit, and
      their HP loss from this skill is reduced by 90%. Mehira always targets the direction that hits
      the most enemies.
    </p>
  </article>
</template>
