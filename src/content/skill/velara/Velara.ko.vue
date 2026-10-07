<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>
          무자비한 의식의 속성 이전은 비영구 버프입니다. 다만 각성의 힘이 있으면 전투가 끝날 때까지
          지속되므로 더 이상 비영구 버프로 보지 않습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
