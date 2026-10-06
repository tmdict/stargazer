<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="dot">
        <p>
          持续伤害指中毒、燃烧、流血等持续性状态造成的伤害或生命流失。反复命中的技能不会仅因为每秒造成一次伤害就算作持续伤害。
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
