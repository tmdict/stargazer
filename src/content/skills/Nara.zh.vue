<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'

import { gridStyles, images } from './Nara.data'

setupContentMeta({
  title: '奈拉 · 铁索勾魂',
  description:
    '战斗开始时，标记最靠近对称位置的敌人并闪现至附近，攻击该敌人。该效果不会导致目标英雄被击败，且本技能优先选择最接近对称位置的敌方英雄。',
  url: 'skill/nara',
  locale: 'zh',
  keywords: ['Nara', '奈拉'],
})
</script>

<template>
  <article>
    <h1>奈拉 · 铁索勾魂</h1>
    <p>
      自身普通攻击范围内没有敌方英雄时，将远处的一名敌方英雄钩到自己面前。该效果不会导致目标英雄被击败，且本技能优先选择最接近对称位置的敌方英雄。
    </p>

    <h2>详细信息</h2>
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
</template>
