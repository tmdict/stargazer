<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Reinier.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-tile">
        <p>카투투카는 한쪽에는 아군이, 다른 쪽에는 적군이 있는 대칭 칸 쌍을 찾습니다.</p>
        <p>아군과 적군의 쌍이 여럿이면 다음 규칙으로 우선순위를 정합니다:</p>
        <ul>
          <li>
            <strong>아군 진영 (적군을 노릴 때):</strong> 인접 칸 우선순위: 왼쪽 아래 → 왼쪽 → 오른쪽
            아래 → 오른쪽 → 왼쪽 위 → 오른쪽 위
          </li>
          <li>
            <strong>적군 진영 (아군을 노릴 때):</strong> 인접 칸 우선순위: 오른쪽 위 → 왼쪽 위 →
            오른쪽 → 오른쪽 아래 → 왼쪽 → 왼쪽 아래 (180° 회전)
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
