<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          풍요의 대지의 공격력 및 방어력 증가는 그 위에 서 있는 아군에게 적용되는 비영구 버프입니다.
        </p>
      </SkillSnippet>
    </template>
    <template #ex>
      <SkillSnippet title-key="temp-buff" body-key="temp-buff-definition">
        <p>
          신의 가호 Lv. 3의 효과를 발동하려면 서로 다른 두 아군의 버프가 동시에 적용되어 있어야
          합니다.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
