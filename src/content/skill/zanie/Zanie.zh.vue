<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>祖娅在备战阶段放置的2个激光塔不算作召唤物。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
