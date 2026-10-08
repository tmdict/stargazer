<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="summon">
        <p>전투 준비 단계에 배치하는 플루스토의 첫 환영은 소환물이 아닙니다.</p>
      </SkillSnippet>
    </template>
    <template #ex>
      <SkillSnippet title-key="summon">
        <p>새로 소환되는 환영은 소환물로 취급됩니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
