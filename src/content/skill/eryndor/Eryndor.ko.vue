<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="debuff">
        <p>
          속성 감소에는 공격력, 방어력, 급속, 활력, 이동 속도, 에너지 회복이 포함됩니다. 적군이 받는
          대미지를 늘리는 효과만으로는 해당하지 않습니다.
        </p>
        <p>
          디버프가 여러 개여도 아군 한 명이 적군 한 명에게 부여할 수 있는 불운은 1스택뿐입니다.
          불운은 디버프가 끝난 뒤에도 남습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
