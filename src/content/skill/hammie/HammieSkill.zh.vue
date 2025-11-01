<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '漫漫 · 技能',
  description: '为最虚弱的友军回复160%生命值，并为该友军提升10%攻击力，持续5秒。',
  url: 'skill/hammie',
  locale: 'zh',
  keywords: ['Hammie', '漫漫'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>漫漫</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>为[[最虚弱的]]友军回复[[160%]]生命值，并为该友军提升[[10%]]攻击力，持续[[5]]秒。</p>
    </article>
  </StyledText>
</template>
