<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Saida.data'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="guide-targeting">
        <p>
          시타는 자신에게 인접한 타일부터 바깥쪽으로 넓혀 가며 아군을 찾고, 처음 찾은 2명에게 흡수의
          씨앗을 심습니다:
        </p>
        <ul>
          <li>
            <strong>1번 고리:</strong> 바로 인접한 6칸. 가장 앞 행에서 가장 뒤 행 순으로, 같은
            행에서는 오른쪽에서 왼쪽으로(타일 번호가 작은 쪽부터) 확인합니다.
          </li>
          <li><strong>2번 고리:</strong> 거리 2의 12칸. 같은 순서로 확인합니다.</li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.order" layout="inline" />
          <GridSnippet :grid-style="gridStyles.example" layout="inline" />
        </div>
        <p>
          시타가 적군 진영에 있으면 같은 행의 순서가 반대로 바뀌어, 타일 번호가 큰 쪽부터 확인합니다
          (180° 회전).
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
