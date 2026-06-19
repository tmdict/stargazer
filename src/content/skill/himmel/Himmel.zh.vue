<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Himmel.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile">
        <p>
          战斗开始时，若辛美尔相邻格子上的队友中同时存在坦克、法师与辅助职业各一名，辛美尔会与这三位友军组建“冒险伙伴”。若其中任意职业缺失，则不组建队伍。
        </p>
        <p>
          对于每个职业，辛美尔优先选择位置更靠后的角色。当同排有多个该职业的友方角色时，辛美尔会优先选择位置更靠左的角色（较高ID的格子）。
        </p>
        <p>当辛美尔处于敌方阵营时，则优先选择较低ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
