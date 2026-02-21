<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lyca', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Lyca</h1>

      <h2>Non-Permanent Buff (Instant) · Energy Recharge</h2>

      <h3>Skill</h3>
      <p>
        Lyca bestows blessings of the stars, increasing all allies' ATK SPD by [[25]] for [[6]]s.
        This effect is triggered immediately when a battle starts and grants all allies [[120]]
        Energy.
      </p>

      <h3>Enhance Force</h3>
      <p><strong>Level 2:</strong> Lyca gains [[300]] extra Initial Energy.</p>
    </article>
  </StyledText>
</template>
