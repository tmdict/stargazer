<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Nara.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>
          나라는 먼저 자신의 대칭 타일(맵 중심을 기준으로 반대편에 있는 타일)을 확인합니다. 그
          타일에 상대가 있으면 그 상대가 대상이 됩니다.
        </p>
        <p>
          대칭 타일이 비어 있으면, 그 타일에서 시계 방향 나선으로 넓혀 가며 가장 가까운 상대를
          찾습니다:
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
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
