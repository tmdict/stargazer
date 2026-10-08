<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Satrana.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          2칸 범위는 사트라나에 인접한 6칸(아래 그림의 1)과 그 바깥을 둘러싼 타일(아래 그림의 2)을
          포함합니다. 이 타일에 서 있는 아군은 모두 불씨를 받습니다.
        </p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
