<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="temp-buff">
        <p>
          영광의 경기장의 공격력 증가는 칼라의 진영이 경기장을 통제하는 동안 모든 아군에게 적용되는
          비영구 버프입니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
