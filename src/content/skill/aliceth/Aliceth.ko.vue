<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Aliceth.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title="타겟팅 (아군)">
        <p>
          알렉시스는 먼저 자신과 같은 행에 있는 같은 팀 영웅을 확인합니다. 같은 행에 여러 명이
          있으면 더 가까운 영웅을 대상으로 삼고, 거리가 같으면 더 왼쪽(칸 번호가 큰 쪽)에 있는
          영웅을 우선합니다.
        </p>
        <p>
          같은 행에 같은 팀 영웅이 없으면, 자신의 칸에 인접한 칸부터 바깥쪽으로 넓혀 가며 찾습니다:
        </p>
        <ul>
          <li>
            <strong>1번 고리:</strong> 바로 인접한 6칸. 가장 앞 행에서 가장 뒤 행 순으로, 왼쪽에서
            오른쪽으로 확인합니다.
          </li>
          <li>
            <strong>2번 고리:</strong> 거리 2의 12칸. 가장 앞 행에서 가장 뒤 행 순으로, 왼쪽에서
            오른쪽으로 확인합니다.
          </li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.rowScan1" layout="inline" />
          <GridSnippet :grid-style="gridStyles.rowScan2" layout="inline" />
        </div>
        <p>
          다르게 표현하면, 알렉시스는 인접한 칸부터 바깥쪽으로 넓혀 가며 칸 번호가 큰 칸에서 작은 칸
          순으로 살펴보고, 처음 발견한 같은 팀 영웅을 대상으로 삼습니다.
        </p>
        <p>
          알렉시스가 적군 진영에 있으면 이 동작이 반대로 바뀌어, 오른쪽(칸 번호가 작은 쪽)에서
          왼쪽(칸 번호가 큰 쪽)으로 살펴봅니다.
        </p>
      </SkillSnippet>
      <SkillSnippet title="타겟팅 (적군)">
        <p>알렉시스는 자신에게서 가장 멀리 있는 상대 팀 영웅을 대상으로 삼습니다.</p>
        <p>가장 먼 상대는 육각 맵 기준 거리로 계산합니다.</p>
        <p>거리가 같은 상대가 여럿일 때:</p>
        <ul>
          <li><strong>아군 진영 알렉시스:</strong> 칸 번호가 더 작은 상대를 우선합니다</li>
          <li>
            <strong>적군 진영 알렉시스:</strong> 칸 번호가 더 큰 상대를 우선합니다 (180° 회전)
          </li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
