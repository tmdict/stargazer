<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>Absolute Defense grants a temporary buff to the ally in the Doomfield.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
