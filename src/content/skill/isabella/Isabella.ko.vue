<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Isabella.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>
          맵은 가로 행으로 구성되어 있습니다. 15행(44, 45번 타일)이 적군 진영의 가장 뒤이고, 1행(1,
          2번 타일)이 아군 진영의 가장 뒤입니다.
        </p>
        <p>
          같은 행 안에서는 아군 진영의 경우 가장 왼쪽(타일 번호가 큰 쪽) 타일이 "더 앞"이고, 적군
          진영의 경우 가장 오른쪽(타일 번호가 작은 쪽) 타일이 "더 앞"입니다.
        </p>
        <p>가장 앞에 있는 영웅은 육각 맵에서의 위치로 결정됩니다:</p>
        <ul>
          <li>
            <strong>아군 진영 이사벨라:</strong> 아군의 위치를 가장 앞 행부터 왼쪽에서
            오른쪽으로(타일 번호가 큰 타일에서 작은 타일 순으로) 살펴보고, 처음 발견한 같은 팀
            영웅을 대상으로 삼습니다.
          </li>
          <li>
            <strong>적군 진영 이사벨라:</strong> 적군의 위치를 반대 순서로, 오른쪽에서 왼쪽으로(타일
            번호가 작은 타일에서 큰 타일 순으로) 살펴보고, 처음 발견한 같은 팀 영웅을 대상으로
            삼습니다.
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
