<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Niru.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>남은 아군이 없으면 니루는 자기 자신을 대상으로 삼을 수 있습니다.</p>
      </SkillSnippet>
    </template>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          니루는 자신에게 인접한 타일부터 바깥쪽으로 넓혀 가며 같은 팀 영웅을 찾고, 뒤쪽에 있는
          영웅을 우선합니다. 같은 행에 여러 명이 있으면 왼쪽(타일 번호가 큰 쪽)에 있는 영웅을
          우선합니다:
        </p>
        <ul>
          <li>
            <strong>1번 고리:</strong> 바로 인접한 6칸. 가장 뒤 행에서 가장 앞 행 순으로, 왼쪽에서
            오른쪽으로(타일 번호가 큰 쪽부터) 확인합니다.
          </li>
          <li>
            <strong>2번 고리:</strong> 거리 2의 12칸. 가장 뒤 행에서 가장 앞 행 순으로, 왼쪽에서
            오른쪽으로(타일 번호가 큰 쪽부터) 확인합니다.
          </li>
          <li>이후에도 같은 방식으로 이어집니다.</li>
        </ul>
        <p>적군 진영에 있을 때는 타일 번호가 더 작은 같은 팀 영웅을 우선합니다 (180° 회전)</p>
        <GridSnippet :grid-style="gridStyles.main" />
        <p>
          니루는 플루스토의 환영이나 일리아&amp;라이라의 라이라(분홍색 쌍둥이) 같은 소환물과 분신도
          대상으로 삼을 수 있습니다.
        </p>
      </SkillSnippet>
    </template>
    <template #awakening>
      <SkillSnippet title-key="guide-targeting">
        <p>영혼 포식의 비영구 버프는 세미라와 데이먼에게만 적용됩니다.</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
