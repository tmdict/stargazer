<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>“提神配方”的非永久增益通过“特制香薰”在战斗开始时制造的香薰作用于友军。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
