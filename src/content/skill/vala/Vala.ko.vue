<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>베라는 자신에게서 가장 멀리 있는 상대 팀 영웅을 대상으로 삼습니다.</p>
        <p>가장 먼 상대는 육각 맵 기준 거리로 계산합니다.</p>
        <p>거리가 같은 상대가 여럿일 때:</p>
        <ul>
          <li><strong>아군 진영 베라:</strong> 칸 번호가 더 작은 상대를 우선합니다</li>
          <li><strong>적군 진영 베라:</strong> 칸 번호가 더 큰 상대를 우선합니다 (180° 회전)</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
