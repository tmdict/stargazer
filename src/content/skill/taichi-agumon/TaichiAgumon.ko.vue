<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="energy-battery">
        <p>
          추가 에너지는 파피몬만 받을 수 있으며, 파피몬이 워그레이몬보다 뒤에 배치되어 있어야
          합니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
