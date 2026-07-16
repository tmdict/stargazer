<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Cassadee.data'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>
          科丝蒂从与她相邻的格子开始搜索队友，并向外扩展，优先选择位置更靠后的角色。当同排有多个友方角色时，科丝蒂会优先选择位置更靠右的角色（较低ID的格子）：
        </p>
        <ul>
          <li>
            <strong>第1环：</strong>紧邻的6个格子，从最后排到最前排，从右到左（较低ID的格子）。
          </li>
          <li>
            <strong>第2环：</strong>距离为2的12个格子，从最后排到最前排，从右到左（较低ID的格子）。
          </li>
          <li>以此类推...</li>
        </ul>
        <p>当科丝蒂处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
