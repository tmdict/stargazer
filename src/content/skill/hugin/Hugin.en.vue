<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>The mechanical sigil's ATK bonus is a temporary buff for the ally standing on it.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
