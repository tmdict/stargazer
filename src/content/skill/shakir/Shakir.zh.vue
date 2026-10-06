<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>“战无不克”会将该攻击力加成以非永久增益的形式分享给“狂狼光环”内的友军。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
