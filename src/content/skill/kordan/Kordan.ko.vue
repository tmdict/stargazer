<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>사냥 전장의 공격력 증가는 그 안에 서 있는 아군에게 적용되는 비영구 버프입니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
