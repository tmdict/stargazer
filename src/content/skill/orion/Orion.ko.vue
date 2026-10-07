<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff" body-key="temp-buff-definition">
        <p>
          각 아군은 한 번만 추종자가 될 수 있습니다. 같은 아군이 버프를 더 주어도 마법 부여는 다시
          연장되지 않습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
