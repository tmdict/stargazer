<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Silvina.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>
          실비나는 먼저 자신의 대칭 칸(맵 중심을 기준으로 반대편에 있는 칸)을 확인합니다. 그 칸에
          상대가 있으면 그 상대가 대상이 됩니다.
        </p>
        <p>
          대칭 칸이 비어 있으면, 그 칸에서 시계 방향 나선으로 넓혀 가며 가장 가까운 상대를 찾습니다:
        </p>
        <ul>
          <li><strong>1번 고리:</strong> 바로 인접한 6칸</li>
          <li><strong>2번 고리:</strong> 거리 2의 12칸</li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" />
        <p>
          아군 진영(상대를 노릴 때)은 오른쪽 위에서 시계 방향으로 돌고, 적군 진영(상대를 노릴 때)은
          왼쪽 아래에서 반시계 방향으로 돕니다 (180° 회전).
        </p>
        <p>(실비나의 타겟팅 메커니즘을 정리해 주신 rkkñ 님께 감사드립니다)</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
