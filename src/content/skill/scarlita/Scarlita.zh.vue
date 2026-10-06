<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          拥有觉醒之力时，受护盾保护的友军还会获得非永久的护甲与魔抗增益。仅有护盾不算作非永久属性提升效果。
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
