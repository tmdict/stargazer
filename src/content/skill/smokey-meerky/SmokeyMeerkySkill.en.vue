<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('smokey-meerky', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Smokey & Meerky</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Smokey & Meerky create an aroma within 2 tiles and keep it going through channeling when a
        battle starts.
      </p>

      <h3>Skill</h3>
      <p>Smokey & Meerky increase the ATK of allies within the aroma by [[16%]].</p>
    </article>
  </StyledText>
</template>
