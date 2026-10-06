<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>护甲魔抗增益只对被宝石命中的敌人周围1格内的友军生效。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
