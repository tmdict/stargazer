<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>기계 연동 장치의 공격력 증가는 그 위에 서 있는 아군에게 적용되는 비영구 버프입니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
