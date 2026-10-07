<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Galahad.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="summon">
        <p>갈라하드의 잔상은 소환물로 취급됩니다.</p>
      </SkillSnippet>
    </template>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          갈라하드는 자신에게 인접한 칸부터 바깥쪽으로 넓혀 가며 같은 팀 영웅을 찾고, 뒤쪽에 있는
          영웅을 우선합니다. 같은 행에 여러 명이 있으면 오른쪽(칸 번호가 작은 쪽)에 있는 영웅을
          우선합니다:
        </p>
        <ul>
          <li>
            <strong>1번 고리:</strong> 바로 인접한 6칸. 가장 뒤 행에서 가장 앞 행 순으로, 오른쪽에서
            왼쪽으로(칸 번호가 작은 쪽부터) 확인합니다.
          </li>
          <li>
            <strong>2번 고리:</strong> 거리 2의 12칸. 가장 뒤 행에서 가장 앞 행 순으로, 오른쪽에서
            왼쪽으로(칸 번호가 작은 쪽부터) 확인합니다.
          </li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <p>적군 진영에 있을 때는 칸 번호가 더 큰 같은 팀 영웅을 우선합니다 (180° 회전)</p>
        <GridSnippet :grid-style="gridStyles.main" />
        <p>
          갈라하드는 본체 영웅만 대상으로 삼으며, 플루스토의 환영이나 일리아&amp;라이라의
          라이라(분홍색 쌍둥이) 같은 소환물과 분신은 건너뜁니다.
        </p>
      </SkillSnippet>
      <SkillSnippet title-key="summon">
        <p>표식이 부여된 아군의 잔상은 소환물로 취급됩니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
