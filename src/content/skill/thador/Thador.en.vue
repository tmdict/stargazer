<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('thador', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Thador</h1>

      <h2>Energy Recharge</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> During battle preparation, Thador designates the ally placed 1
        tile behind him as his lieutenant.
      </p>

      <h3>EX Skill</h3>
      <p>
        <strong>Level 3:</strong> Grants Thador's lieutenant [[350]] Energy when a battle starts.
      </p>
    </article>
  </StyledText>
</template>
