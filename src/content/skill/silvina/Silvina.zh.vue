<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Silvina.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>西尔维娜首先检查她的对称格子（网格的镜像位置）。如果那里有对手，则选择为目标。</p>
        <p>如果对称格子是空的，西尔维娜会以顺时针螺旋模式搜索离该位置最近的对手：</p>
        <ul>
          <li><strong>第1环：</strong>紧邻的6个格子</li>
          <li><strong>第2环：</strong>距离为2的12个格子</li>
          <li>以此类推...</li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
        <p>
          友方（瞄准对手）从右上角顺时针行走，而敌方（瞄准对手）从左下角逆时针行走（180°旋转）。
        </p>
        <p>（感谢rkkñ提供西尔维娜的机制信息）</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
