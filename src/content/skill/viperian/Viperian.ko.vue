<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="energy-denial">
        <p>
          다크 바이퍼가 부착되면 적군이 피격 시 얻는 에너지가 줄어듭니다. 이미 가진 에너지를
          빼앗지는 않습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
