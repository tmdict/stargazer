<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('bryon', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Bryon</h1>

      <h2>Instant Ultimate · Summon</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Passive.</strong> When a battle starts, Bryon gains 1000 Initial Energy and summons
        his falcon Elona.
      </p>
      <p>
        <strong>Active.</strong> Bryon consumes [[300]] Energy, calling Elona to deal [[320%]]
        damage to his current target. Elona remains on the battlefield, consuming increasing amounts
        of Energy over time. When she runs out of Energy or Bryon is defeated, Elona leaves the
        battlefield.
      </p>

      <h2>Energy Reduction</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> Bryon's normal attacks and skills deal damage [[2]] times,
        absorbing targets' [[50]] Energy.
      </p>
    </article>
  </StyledText>
</template>
