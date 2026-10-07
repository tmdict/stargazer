<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>절대 방어는 재앙의 영역에 있는 아군에게 비영구 버프를 부여합니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
