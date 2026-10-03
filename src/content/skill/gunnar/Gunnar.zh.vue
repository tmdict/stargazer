<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>“绝对防御”会为“灾厄枢纽”内的友军提供非永久增益。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
