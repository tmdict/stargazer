<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="debuff">
        <p>
          属性降低包括攻击力、护甲魔抗、急速、受愈、移动速度和回能效率。仅使敌人受到更多伤害的效果不算在内。
        </p>
        <p>
          每名友军对同一名敌人只能叠加1层“厄运”，即使施加多个减益也是如此。减益结束后“厄运”仍会保留。
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
