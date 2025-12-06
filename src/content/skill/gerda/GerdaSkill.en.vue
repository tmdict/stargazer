<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Gerda · Skills',
  description:
    'When a battle starts, Gerda leaps forward up to 3 tiles and stomps the ground to unleash a spring, dealing 200% damage with an interruption effect to enemies within 1 tile. Then she creates a hot spring within a 2-tile radius. Allies within this area recover 25% HP per second, while enemies recover 4% HP per second (capped at 0.5% of their max HP). Gerda is unaffected when casting this skill.',
  url: 'skill/gerda',
  locale: 'en',
  keywords: ['Gerda', '格尔达', '熊女'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Gerda</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Gerda leaps forward up to 3 tiles and stomps the ground to unleash a
        spring, dealing [[200%]] damage with an interruption effect to enemies within 1 tile. Then
        she creates a hot spring within a 2-tile radius. Allies within this area recover [[25%]] HP
        per second, while enemies recover [[4%]] HP per second (capped at [[0.5%]] of their max HP).
        Gerda is [[unaffected]] when casting this skill.
      </p>
    </article>
  </StyledText>
</template>
