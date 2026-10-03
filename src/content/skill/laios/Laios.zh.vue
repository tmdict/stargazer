<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="energy-battery">
        <p>“迷宫美食家”的充能效果仅对玛露西尔生效。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
