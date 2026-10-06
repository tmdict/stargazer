<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="energy-battery">
        <p>只有加布兽能获得额外能量，并且他必须位于战斗暴龙兽身后。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
