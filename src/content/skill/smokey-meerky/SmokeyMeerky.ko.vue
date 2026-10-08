<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>전투 시작 시 특제 향기의 범위 안에 있는 아군은 각성제의 비영구 버프를 받습니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
