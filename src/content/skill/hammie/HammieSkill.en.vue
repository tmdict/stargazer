<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Hammie · Skills',
  description: 'Hammie heals the weakest ally for 160% HP and increases their ATK by 10% for 5s.',
  url: 'skill/hammie',
  locale: 'en',
  keywords: ['Hammie', '漫漫'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Hammie</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Hammie heals the [[weakest]] ally for [[160%]] HP and increases their ATK by [[10%]] for
        [[5]]s.
      </p>
    </article>
  </StyledText>
</template>
