<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>전투 시작 시:</p>
        <ul>
          <li>메이가 수비 측이고 차단할 대상이 여럿이면, 가장 앞에 있는 상대를 우선합니다.</li>
          <li>메이가 공격 측이고 차단할 대상이 여럿이면, 가장 뒤에 있는 상대를 우선합니다.</li>
          <li>차단할 대상이 없으면 스톰 댄스를 대신 사용합니다.</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
