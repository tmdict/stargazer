<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('perseus', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Perseus</h1>

      <h2>Non-Permanent Buff (Instant)</h2>

      <h3>Skill</h3>
      <p>
        Before Perseus takes heavy damage, the ground within 1 tile around him turns fertile. Allies
        standing on this fertile ground have their ATK increased by [[14%]] and Phys & Magic DEF
        increased by [[19%]].
      </p>

      <strong>How It Works</strong>
      <p>Tile positional buffs are considered temporary buffs.</p>
    </article>
  </StyledText>
</template>
