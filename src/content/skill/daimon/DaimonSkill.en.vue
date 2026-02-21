<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('daimon', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Daimon</h1>

      <h2>Non-Permanent Buff · Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Daimon forms a bond with the ally placed behind him during battle preparation. Whenever
        Daimon gains a shield, the bonded ally also receives [[24%]] of that shield for the same
        duration. While shielded by Daimon, the bonded ally gains an extra [[15]] Life Drain and
        [[25%]] ATK. If the bonded ally is defeated, Daimon will immediately bond with the
        [[weakest]] ally.
      </p>
    </article>
  </StyledText>
</template>
