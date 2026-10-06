<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff" body-key="temp-buff-definition">
        <p>每名友军只能成为一次“党羽”。同一名友军之后施加的增益不会再次延长“细剑附魔”。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
