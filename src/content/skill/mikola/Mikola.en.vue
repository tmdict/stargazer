<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="temp-buff">
        <p>
          The Honor Arena's ATK bonus is a temporary buff for all allies while Mikola's side
          controls the arena.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
