<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '缇洛亚 · 技能',
  url: 'skill/tilaya',
  locale: 'zh',
  keywords: ['Tilaya', '缇洛亚'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>科丝蒂 (水法)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，选择布阵时距离自己最近的一名友军（相同距离下优先选择更靠近自己身后的友军），为其施加“潮汐之力”祝福。每当受祝福友军的普通攻击命中敌人时，科丝蒂将对这名敌人额外造成一次[[60%]]魔法伤害。累计触发[[9]]次效果后，该祝福效果将会消失，科丝蒂会在[[9]]秒冷却时间过后再次对该友军施加祝福。该祝福效果无法被驱散。
      </p>
    </article>
  </StyledText>
</template>
