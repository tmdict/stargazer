<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>“斗猎围场”为围场内友军提供的攻击力加成属于非永久增益。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
