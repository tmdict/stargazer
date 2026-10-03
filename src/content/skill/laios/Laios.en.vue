<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="energy-battery">
        <p>Only Marcille receives extra Energy from Dungeon Gourmet's meals.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
