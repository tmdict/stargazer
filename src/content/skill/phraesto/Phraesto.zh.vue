<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="summon">
        <p>普鲁斯托在备战阶段放置的第一个幻象不是召唤物。</p>
      </SkillSnippet>
    </template>
    <template #ex>
      <SkillSnippet title-key="summon">
        <p>重新召唤的新幻象视为召唤物。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
