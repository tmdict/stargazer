<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('berial', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Berial</h1>

      <h2>Summon</h2>

      <h3>EX Skill</h3>
      <p>
        If non-summoned enemies remain [[isolated]] for over [[3]]s, they lose [[180]] Energy and
        generate a Silhouette that inherits [[50%]] of Berial's ATK, HP, and 100% of other stats.
        The Silhouette loses [[8%]] of its max HP per second. This effect can only be triggered once
        on the same target within [[20]]s, and the Silhouette can only deal damage by normal
        attacks.
      </p>
    </article>
  </StyledText>
</template>
