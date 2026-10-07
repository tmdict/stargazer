<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Faramor.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          팔라모르는 자신에게 인접한 칸의 같은 팀 영웅을 찾고, 뒤쪽에 있는 영웅을 우선합니다. 같은
          행에 여러 명이 있으면 오른쪽(칸 번호가 작은 쪽)에 있는 영웅을 우선합니다.
        </p>
        <p>적군 진영에 있을 때는 칸 번호가 더 큰 같은 팀 영웅을 우선합니다 (180° 회전).</p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
