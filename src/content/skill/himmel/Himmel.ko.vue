<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Himmel.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          전투가 시작되면 힘멜은 자신에게 인접한 칸의 같은 팀 영웅 가운데 탱커 1명, 마법사 1명,
          서포터 1명과 모험의 동료를 이룹니다. 인접한 영웅 중에 세 직업 가운데 하나라도 없으면
          모험의 동료는 결성되지 않습니다.
        </p>
        <p>
          직업마다 뒤쪽에 있는 영웅을 우선합니다. 해당 직업의 영웅이 같은 행에 여러 명 있으면
          왼쪽(칸 번호가 큰 쪽)에 있는 영웅을 우선합니다.
        </p>
        <p>적군 진영에 있을 때는 칸 번호가 더 작은 같은 팀 영웅을 우선합니다 (180° 회전).</p>
        <GridSnippet :grid-style="gridStyles.main" />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
