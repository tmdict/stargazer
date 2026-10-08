<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Cassadee.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          카세디아는 자신에게 인접한 타일부터 바깥쪽으로 넓혀 가며 같은 팀 영웅을 찾고, 뒤쪽에 있는
          영웅을 우선합니다. 같은 행에 여러 명이 있으면 오른쪽(타일 번호가 작은 쪽)에 있는 영웅을
          우선합니다:
        </p>
        <ul>
          <li>
            <strong>1번 고리:</strong> 바로 인접한 6칸. 가장 뒤 행에서 가장 앞 행 순으로, 오른쪽에서
            왼쪽으로(타일 번호가 작은 쪽부터) 확인합니다.
          </li>
          <li>
            <strong>2번 고리:</strong> 거리 2의 12칸. 가장 뒤 행에서 가장 앞 행 순으로, 오른쪽에서
            왼쪽으로(타일 번호가 작은 쪽부터) 확인합니다.
          </li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <p>적군 진영에 있을 때는 타일 번호가 더 큰 같은 팀 영웅을 우선합니다 (180° 회전).</p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
