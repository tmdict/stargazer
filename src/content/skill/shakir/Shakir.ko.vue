<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          백전백승 효과로 와일드 울프 오라 안의 아군도 이 공격력 증가 효과를 비영구 버프로 받습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
