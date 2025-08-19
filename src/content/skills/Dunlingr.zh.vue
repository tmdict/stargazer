<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '顿里尔 · 秩序种',
  description:
    '在战斗开始前指定一个友方角色。在战斗中，根据钟设置的模式，以下效果将应用于场上除友方目标外的所有角色',
  url: 'skill/dunlingr',
  locale: 'zh',
  keywords: ['Dunlingr', '顿里尔'],
})
</script>

<template>
  <article>
    <h1>顿里尔 · 秩序种</h1>
    <p>
      在战斗开始前指定一个友方角色。在战斗中，根据钟设置的模式，以下效果将应用于场上除友方目标外的所有角色：
    </p>
    <ul>
      <li>禁咒：无法使用终极技能。</li>
      <li>抑生：无法治疗其它角色。</li>
    </ul>

    <h2>详细信息</h2>
    <p>顿里尔会自动识别并标记距离他当前格子最远的友方角色。</p>
    <p>距离计算使用六边形网格距离来确定最远的队友。顿里尔不能瞄准自己。</p>
    <p>当多个队友距离相等时：</p>
    <ul>
      <li><strong>友方顿里尔：</strong>优先选择格子ID更低的队友</li>
      <li><strong>敌方顿里尔：</strong>优先选择格子ID更高的队友（180°旋转）</li>
    </ul>
  </article>
</template>
