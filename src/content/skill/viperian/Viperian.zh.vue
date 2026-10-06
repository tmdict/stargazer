<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="energy-denial">
        <p>“冥蛇”附身会降低敌人的受击回能，不会扣除其已有的能量。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
