<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '顿里尔 (钟神) · 技能',
  description: '战斗开始前，顿里尔可以指定本场战斗中秩序钟的形态为“禁咒”或“抑生”之一。',
  url: 'skill/dunlingr',
  locale: 'zh',
  keywords: ['Dunlingr', '顿里尔', '钟神'],
})
</script>

<template>
  <article>
    <h1>顿里尔 (钟神)</h1>

    <h2>大招打断</h2>

    <h3>终极技能</h3>
    <p>战斗开始前，顿里尔可以指定本场战斗中秩序钟的形态为“禁咒”或“抑生”之一。</p>
    <ul>
      <li>“禁咒”：无法使用终极技能。</li>
      <li>“抑生”：无法治疗其他角色。</li>
    </ul>

    <p>被动地，战斗开始时，秩序钟会立刻降临，持续12秒。</p>

    <h2>特殊目标机制</h2>

    <h3>专武技能</h3>
    <p>顿里尔庇佑备战时离自身距离最远的非召唤物友军，使其不受到自身秩序的约束，直至其被击败。</p>

    <h3>技能机制</h3>

    <p>顿里尔会自动识别并标记距离他当前格子最远的友方角色。</p>
    <p>距离计算使用六边形网格距离来确定最远的队友。顿里尔不能瞄准自己。</p>
    <p>当多个队友距离相等时：</p>
    <ul>
      <li><strong>友方顿里尔：</strong>优先选择格子ID更低的队友</li>
      <li><strong>敌方顿里尔：</strong>优先选择格子ID更高的队友（180°旋转）</li>
    </ul>
  </article>
</template>
