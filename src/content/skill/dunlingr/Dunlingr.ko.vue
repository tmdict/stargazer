<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>던릴은 자신에게서 가장 멀리 있는 같은 팀 영웅을 대상으로 삼습니다.</p>
        <p>
          가장 먼 같은 팀 영웅은 육각 맵 기준 거리로 계산합니다. 던릴은 자기 자신을 대상으로 삼을 수
          없습니다.
        </p>
        <p>거리가 같은 영웅이 여럿일 때:</p>
        <ul>
          <li><strong>아군 진영 던릴:</strong> 타일 번호가 더 작은 영웅을 우선합니다</li>
          <li><strong>적군 진영 던릴:</strong> 타일 번호가 더 큰 영웅을 우선합니다 (180° 회전)</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
