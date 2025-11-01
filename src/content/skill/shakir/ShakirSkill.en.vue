<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Shakir · Skills',
  description:
    'Shakir generates a Lupine Aura in a range of 2-tile while in the wolf shape, dealing damage to all enemies within the frontal radius of the arc with normal attacks. Allies within the range of Lupine Aura reduce 20% taken damage and increase 10 Haste.',
  url: 'skill/shakir',
  locale: 'en',
  keywords: ['Shakir', '沙奎尔', '狼人'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Shakir</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Shakir generates a Lupine Aura in a range of 2-tile while in the wolf shape, dealing damage
        to all enemies within the frontal radius of the arc with normal attacks. Allies within the
        range of Lupine Aura reduce [[20%]] taken damage and increase [[10]] Haste.
      </p>

      <h3>EX Skill</h3>
      <p>
        <strong>Level 3:</strong> Each non-summoned ally within Lupine Aura can share the same bonus
        ATK from Wolf's Will.
      </p>
    </article>
  </StyledText>
</template>
