<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles } from './Saida.data'
</script>

<template>
  <SkillSnippets>
    <template #awakening>
      <SkillSnippet title-key="guide-targeting">
        <p>悉达从与她相邻的格子开始搜索队友，并向外扩展。最先找到的2名队友获得“吮噬心核”：</p>
        <ul>
          <li>
            <strong>第1环：</strong
            >紧邻的6个格子，从最前排到最后排，同一排从右到左（较低ID的格子）。
          </li>
          <li><strong>第2环：</strong>距离为2的12个格子，顺序相同。</li>
          <li>以此类推...</li>
        </ul>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.order" layout="inline" />
          <GridSnippet :grid-style="gridStyles.example" layout="inline" />
        </div>
        <p>当悉达处于敌方阵营时，同一排的顺序会翻转，从较高ID的格子到较低ID的格子（180°旋转）。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
