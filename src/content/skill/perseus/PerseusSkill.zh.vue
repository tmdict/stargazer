<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '珀尔修斯 (人皇) · 技能',
  description:
    '珀尔修斯尚未承受严重伤害时,其周围1格范围内的土地会变成丰饶之地。丰饶之地中的友军提高14.5%攻击力、19%护甲与魔抗。',
  url: 'skill/perseus',
  locale: 'zh',
  keywords: ['Perseus', '珀尔修斯', '人皇'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>珀尔修斯 (人皇)</h1>

      <h2>开局增益 · 非永久增益</h2>

      <h3>技能</h3>
      <p>
        珀尔修斯尚未承受严重伤害时,其周围1格范围内的土地会变成丰饶之地。丰饶之地中的友军提高[[14.5%]]攻击力、[[19%]]护甲与魔抗。
      </p>
    </article>
  </StyledText>
</template>
