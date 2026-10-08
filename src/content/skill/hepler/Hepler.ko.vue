<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Hepler.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          헤플러는 자신에게 인접한 타일의 같은 팀 영웅을 찾고, 앞쪽에 있는 영웅을 우선합니다. 같은
          행에 여러 명이 있으면 왼쪽(타일 번호가 큰 쪽)에 있는 영웅을 우선합니다.
        </p>
        <p>적군 진영에 있을 때는 타일 번호가 더 작은 같은 팀 영웅을 우선합니다 (180° 회전).</p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
