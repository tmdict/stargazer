<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Galahad.data'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="guide-tile">
        <p>
          加拉哈德从与她相邻的格子开始搜索队友，并向外扩展，优先选择位置更靠后的角色。当同排有多个友方角色时，加拉哈德会优先选择位置更靠右的角色（较低ID的格子）：
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
        <p>当加拉哈德处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>
        <GridSnippet :grid-style="gridStyles.main" :images />
        <p>
          加拉哈德只会选择本体角色为目标，跳过召唤物和分身，例如蝎子的分身或双子的副体（粉色双子）。
        </p>
        <p>加拉哈德的残影以及被标记的友方英雄的残影均视为召唤物。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
