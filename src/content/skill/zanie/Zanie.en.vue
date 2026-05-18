<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>The 2 laser turrets Zanie deploys during battle preparation do not count as summons.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
