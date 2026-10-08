<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Evie.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>
          전투가 시작되면 이브는 자신의 대칭 타일(맵 중심을 기준으로 반대편에 있는 타일)을 대상으로
          삼습니다. 조사 범위는 대칭 타일과 그 주변 6칸입니다. 대칭 타일이 장애물로 막혀 있어도
          이브는 조사를 진행합니다.
        </p>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.enemyTarget1" layout="inline" />
          <GridSnippet :grid-style="gridStyles.enemyTarget2" layout="inline" />
        </div>
      </SkillSnippet>
    </template>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          전투가 시작되면 이브의 깃펜은 가장 뒤에 있는 아군(진형에서 가장 뒤쪽에 배치된 같은 팀
          영웅)을 따라갑니다. 이브 자신은 제외됩니다.
        </p>
        <p>가장 뒤는 타일 번호로 정해집니다:</p>
        <ul>
          <li><strong>아군 진영 이브:</strong> 타일 번호가 가장 작은 타일의 아군.</li>
          <li><strong>적군 진영 이브:</strong> 타일 번호가 가장 큰 타일의 아군 (180° 회전).</li>
        </ul>
        <p>
          타겟팅 화살표는 처음 대상만 표시합니다. 전투가 진행되면 깃펜은 누적 대미지를 가장 많이
          입힌 아군에게로 옮겨 갑니다.
        </p>
        <GridSnippet :grid-style="gridStyles.allyTarget" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
