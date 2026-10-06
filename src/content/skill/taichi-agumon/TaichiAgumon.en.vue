<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="energy-battery">
        <p>
          Only Gabumon can receive the extra Energy, and he must be positioned behind Wargreymon.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
