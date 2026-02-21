<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Tilaya · Skills',
  url: 'skill/kordan',
  locale: 'en',
  keywords: ['Tilaya', '缇洛亚'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Tilaya</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Passive. When a battle starts, Tilaya loses [[70%]] HP and gains Vine Ward, a shield that
        blocks up to [[120%]] damage. Vine Ward automatically recovers [[10%]] shield value every
        second and makes Tilaya [[unaffected]] while active. When Vine Ward breaks, it enters a
        [[3]]-second cooldown, after which its shield value is restored to [[45%]].
      </p>

      <h3>EX Skill</h3>
      <p>
        <strong>Level 3:</strong> After Vine Ward remains active for [[15]]s, its bond with nature
        deepens. While active, it increases the max HP by [[40%]] and Phys & Magic DEF by [[60%]]
        for all allies within 2 tiles. The max HP gained from this effect cannot exceed [[80%]] of
        Tilaya's initial max HP.
      </p>
    </article>
  </StyledText>
</template>
