<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Silvina.data'

setupSkillContentMeta('silvina', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>西尔维娜 (苍白)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>战斗开始时，标记最靠近[[对称]]位置的敌人并闪现至附近，攻击该敌人，造成[[300%]]伤害。</p>

      <strong>技能机制</strong>
      <p>西尔维娜首先检查她的对称格子（网格的镜像位置）。如果那里有敌人，则选择为目标。</p>
      <p>如果对称格子是空的，西尔维娜会以顺时针螺旋模式搜索离该位置最近的敌人：</p>
      <ul>
        <li><strong>第1环：</strong>紧邻的6个格子</li>
        <li><strong>第2环：</strong>距离为2的12个格子</li>
        <li>以此类推...</li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <p>友方（瞄准敌人）从右上角顺时针行走，而敌方（瞄准友方）从左下角逆时针行走（180°旋转）。</p>
      <p>（感谢rkkñ提供西尔维娜的机制信息）</p>
    </article>
  </StyledText>
</template>
