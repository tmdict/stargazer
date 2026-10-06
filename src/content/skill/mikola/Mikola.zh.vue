<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="temp-buff">
        <p>己方控制“荣耀擂台”时，全体友军获得的攻击力加成属于非永久增益。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
