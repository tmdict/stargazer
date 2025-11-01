<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '罗万 (商人) · 技能',
  description:
    '战移动至多1格，并在抵达目的地后持续抛酒金币，使周围2格范围内的其他友军回复共250点能量。',
  url: 'skill/rowan',
  locale: 'zh',
  keywords: ['Rowan', '罗万', '商人'],
})
</script>

<template>
  <article>
    <h1>罗万 (商人)</h1>

    <h2>充能</h2>

    <h3>终极技能</h3>
    <p>移动至多1格，并在抵达目的地后持续抛酒金币，使周围2格范围内的其他友军回复共250点能量。</p>

    <h3>技能</h3>
    <p>
      <strong>3级：</strong>
      战斗开始时，在推车上额外布置1瓶“能量药剂”，自身周围2格内的其他友军在能量高于600时，会自动使用“能量药剂”，回复400点能量。
    </p>
  </article>
</template>
