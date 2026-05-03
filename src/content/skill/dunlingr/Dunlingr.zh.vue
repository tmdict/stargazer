<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('dunlingr', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>顿里尔 (钟神)</h1>

      <h2>大招打断</h2>

      <h3>终极技能</h3>
      <p>战斗开始前，顿里尔可以指定本场战斗中秩序钟的形态为“禁咒”或“抑生”之一。</p>
      <ul>
        <li>“禁咒”：无法使用终极技能。</li>
        <li>“抑生”：无法治疗其他角色。</li>
      </ul>
      <p>被动地，战斗开始时，秩序钟会立刻降临，持续[[12]]秒。</p>

      <h2>特殊目标机制</h2>

      <h3>专武技能</h3>
      <p>顿里尔庇佑备战时离自身距离最远的非召唤物友军，使其不受到自身秩序的约束，直至其被击败。</p>

      <strong>技能机制</strong>
      <p>顿里尔会自动识别并锁定距离他所在格子最远的敌方角色。</p>
      <p>距离计算使用六边形网格距离来确定最远的敌人。</p>
      <p>当多个敌人距离相等时：</p>
      <ul>
        <li><strong>友方顿里尔：</strong>优先选择格子ID较小的敌人</li>
        <li><strong>敌方顿里尔：</strong>优先选择格子ID较大的敌人（180°旋转）</li>
      </ul>

      <h2>非永久增益 · 削能</h2>

      <h3>觉醒之力</h3>
      <p>
        主动使用终极技能时，若宣告“禁咒”秩序，还会使所有友军获得[[50]]点攻击速度，持续[[6]]秒；若宣告“抑生”秩序，还会使所有友军获得[[25]]点生命汲取，持续[[6]]秒。
      </p>
      <p>
        <strong>2级</strong
        >每当秩序结束或被刷新时长时，若自身依然存活，则根据秩序钟形态触发额外效果：
      </p>
      <ul>
        <li>“禁咒”：所有敌人失去[[150]]点能量，并降低[[10]]点急速，持续[[8]]秒。</li>
        <li>“抑生”：所有敌人失去[[150%]]生命值，并降低[[50]]点受愈，持续[[8]]秒。</li>
      </ul>
    </article>
  </StyledText>
</template>
