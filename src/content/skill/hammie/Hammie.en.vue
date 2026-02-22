<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hammie', 'en')
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
