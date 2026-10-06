<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>“机械联动装置”为装置上的友军提供的攻击力加成属于非永久增益。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
