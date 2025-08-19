<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'

import { gridStyles, images } from './Reinier.data'

setupContentMeta({
  title: '雷内亚 · 动态平衡',
  description:
    '战斗开始时，若自身1格范围内存在一名友军与敌军的位置处于对称关系。战斗开始后，被连接的友方和敌方位置会互换，友方获得增益效果，敌方获得减益效果。',
  url: 'https://stargazer.tmdict.com/zh/skill/reinier',
  keywords: ['Reinier', '雷内亚'],
})
</script>

<template>
  <article>
    <h1>雷内亚 · 动态平衡</h1>
    <p>
      战斗开始时，若自身1格范围内存在一名友军与敌军的位置处于对称关系。战斗开始后，被连接的友方和敌方位置会互换，友方获得增益效果，敌方获得减益效果。
    </p>

    <h2>详细信息</h2>
    <p>雷内亚会自动识别并标记对称，并包含友方和敌方角色的格子对。</p>
    <p>当存在多个友方敌方对时，使用以下规则处理平局：</p>
    <ul>
      <li>
        <strong>友方队伍（瞄准敌人）：</strong>相邻格子优先级：左下 > 左 > 右下 > 右 > 左上 > 右上
      </li>
      <li>
        <strong>敌方队伍（瞄准友方）：</strong>相邻格子优先级：右上 > 左上 > 右 > 右下 > 左 >
        左下（180°旋转）
      </li>
    </ul>

    <GridSnippet :grid-style="gridStyles.main" :images />
  </article>
</template>
