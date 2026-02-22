<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('rowan', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Rowan</h1>

      <h2>Energy Recharge</h2>

      <h3>Ultimate</h3>
      <p>
        Rowan moves up to [[1]] tile and throws coins upon reaching the destination, recovering
        [[250]] Energy for surrounding allies within 2 tiles.
      </p>

      <h3>Skill</h3>
      <p>
        <strong>Level 3:</strong> Places an energy potion when a battle starts. When the Energy of
        an ally within [[2]] tiles exceeds [[600]], they automatically use this potion to recover
        [[400]] Energy.
      </p>
    </article>
  </StyledText>
</template>
