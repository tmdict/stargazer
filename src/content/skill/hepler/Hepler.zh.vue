<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Hepler.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-targeting">
        <p>
          赫普搜索与自己相邻格子上的队友，优先选择位置更靠前的角色。当同排有多个友方角色时，赫普会优先选择位置更靠左的角色（较高ID的格子）。
        </p>
        <p>当赫普处于敌方阵营时，则优先选择较低ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
