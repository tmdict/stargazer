<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './NaraSkill.data'

setupContentMeta({
  title: '奈拉 (钩子) · 技能',
  description:
    '自身普通攻击范围内没有敌方英雄时，将远处的一名敌方英雄钩到自己面前。目标英雄在被钩的过程中，每被拖拽1格的距离便会流失3.5%的当前生命值，最高不超过自身攻击力的250%。该效果不会导致目标英雄被击败，且本技能优先选择最接近对称位置的敌方英雄。',
  url: 'skill/nara',
  locale: 'zh',
  keywords: ['Nara', '奈拉', '钩子'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>奈拉 (钩子)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        自身普通攻击范围内没有敌方英雄时，将远处的一名敌方英雄钩到自己面前。目标英雄在被钩的过程中，每被拖拽1格的距离便会流失[[3.5%]]的当前生命值，最高不超过自身攻击力的[[250%]]。该效果不会导致目标英雄被击败，且本技能优先选择最接近[[对称]]位置的敌方英雄。
      </p>

      <h3>技能机制</h3>

      <p>奈拉首先检查她的对称格子（网格的镜像位置）。如果那里有敌人，则选择为目标。</p>
      <p>如果对称格子是空的，西尔维娜会以顺时针螺旋模式搜索离该位置最近的敌人：</p>
      <ul>
        <li><strong>第1环：</strong>紧邻的6个格子</li>
        <li><strong>第2环：</strong>距离为2的12个格子</li>
        <li>以此类推...</li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <p>友方（瞄准敌人）从右上角顺时针行走，而敌方（瞄准友方）从左下角逆时针行走（180°旋转）。</p>
    </article>
  </StyledText>
</template>
