<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Lyca · Skills',
  description:
    "Lyca bestows blessings of the stars, increasing all allies' ATK SPD by 25 for 6s. This effect is triggered immediately when a battle starts and grants all allies 120 Energy.",
  url: 'skill/lyca',
  locale: 'en',
  keywords: ['Lyca', '莱卡', '兔弓'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Lyca</h1>

      <h2>Energy Recharge · Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Lyca bestows blessings of the stars, increasing all allies' ATK SPD by [[25]] for [[6]]s.
        This effect is triggered immediately when a battle starts and grants all allies [[120]]
        Energy.
      </p>
    </article>
  </StyledText>
</template>
