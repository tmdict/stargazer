<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Daimon.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          데이먼은 자신의 바로 뒤 칸에 있는 같은 팀 영웅을 찾습니다. 같은 행에 여러 명이 있으면
          왼쪽(칸 번호가 큰 쪽)에 있는 영웅을 우선합니다.
        </p>
        <p>적군 진영에 있을 때는 칸 번호가 더 작은 같은 팀 영웅을 우선합니다 (180° 회전).</p>
        <GridSnippet :grid-style="gridStyles.main" />
        <p>
          계약을 맺은 아군은 전투 시작 시 생명 전이로 데이먼이 첫 실드를 얻을 때 동료 계약의 비영구
          버프를 받습니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
