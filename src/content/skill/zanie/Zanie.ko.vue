<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="summon">
        <p>
          조아가 전투 준비 단계에 설치하는 레이저 포탑 2개는 소환물로 취급되지 않습니다. 기관총
          포탑은 소환물로 취급됩니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
