<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="dot">
        <p>
          지속 대미지는 독, 화상, 출혈처럼 지속되는 디버프가 입히는 대미지 또는 HP 손실을 말합니다.
          매초 반복해서 타격한다는 이유만으로는 지속 대미지에 해당하지 않습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
