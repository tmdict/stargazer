<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>The hunting circle's ATK bonus is a temporary buff for allies standing inside it.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
