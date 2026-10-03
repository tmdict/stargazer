<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>
          “无赦秘仪”的属性转移属于非永久增益。不过，拥有觉醒之力时，属性转移会持续到战斗结束，不再视为非永久增益。
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
