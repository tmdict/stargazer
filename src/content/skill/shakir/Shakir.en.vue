<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          All-Conquering shares this ATK bonus with allies in the Lupine Aura as a temporary buff.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
