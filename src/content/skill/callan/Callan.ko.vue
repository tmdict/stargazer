<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Callan.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>
          실드의 2칸 반경은 카렌에 인접한 6칸(아래 그림의 1)과 그 바깥을 둘러싼 칸(아래 그림의 2)을
          포함합니다. 이 칸에 서 있는 아군은 실드가 유지되는 동안 받는 대미지의 절반을 실드가 대신
          흡수합니다.
        </p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
