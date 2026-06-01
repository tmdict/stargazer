<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="mechanic-companion">
        <p>
          普鲁斯托在备战阶段放置的第一个幻象不是召唤物，但当第一个幻象被击败后生成的第二个幻象是召唤物。
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
