<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="energy-battery">
        <p>던전 미식가의 요리로 추가 에너지를 받는 영웅은 마르실뿐입니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
