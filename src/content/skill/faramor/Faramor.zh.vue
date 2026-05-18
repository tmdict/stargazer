<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Faramor.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="how-it-works">
        <p>
          法拉莫尔搜索与自己相邻格子上的队友，优先选择位置更靠后的角色。当同排有多个友方角色时，法拉莫尔会优先选择位置更靠右的角色（较低ID的格子）。
        </p>
        <p>当法拉莫尔处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
