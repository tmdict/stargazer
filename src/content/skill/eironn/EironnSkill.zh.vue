<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '埃隆 (绿剑) · 技能',
  description:
    '埃隆将双剑力量合二为一，选择一个地图格，吸引附近2格范围内敌人将其向中心聚拢，短暂延迟后产生爆炸，对2格范围内的敌人造成250%伤害，并定身3秒。',
  url: 'skill/eironn',
  locale: 'zh',
  keywords: ['Eironn', '埃隆', '绿剑'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>埃隆 (绿剑)</h1>

      <h2>开局开大招</h2>

      <h3>终极技能</h3>
      <p>
        埃隆将双剑力量合二为一，选择一个地图格，吸引附近2格范围内敌人将其向中心聚拢，短暂延迟后产生爆炸，对2格范围内的敌人造成[[250%]]伤害，并[[定身3]]秒。
      </p>

      <h3>专武技能</h3>
      <p>每场战斗中，埃隆的首次终极技能将不消耗能量。但伤害会减少至原本伤害的[[50%]]。</p>
    </article>
  </StyledText>
</template>
