<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>The DEF buff only reaches allies within 1 tile of the enemy hit by the gem.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
