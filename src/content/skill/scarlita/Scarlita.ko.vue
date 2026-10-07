<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          각성의 힘이 있으면 실드를 받은 아군은 물리 방어력과 마법 방어력 비영구 버프도 함께
          받습니다. 실드만으로는 비영구 속성 버프에 해당하지 않습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
