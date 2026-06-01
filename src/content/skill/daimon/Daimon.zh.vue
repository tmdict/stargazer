<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Daimon.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="mechanic-tile">
        <p>
          戴蒙搜索自己正后方相邻格子上的队友，当同排有多个友方角色时，戴蒙会优先选择位置更靠左的角色（较高ID的格子）。
        </p>
        <p>当戴蒙处于敌方阵营时，则优先选择较低ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
