<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('granny-dahnie', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Granny Dahnie</h1>

      <h2>Energy Reduction</h2>

      <h3>Ultimate</h3>
      <p>
        Granny Dahnie summons Parasitic Grass within 2 tiles for 3s. Every second, enemies within
        range cannot move or act and lose [[25]] Energy and at least [[60%]] HP. The total amount of
        their lost HP is [[130%]]. Granny Dahnie also recovers an equal amount of HP. She is
        [[unaffected]] while Parasitic Grass exists.
      </p>
    </article>
  </StyledText>
</template>
