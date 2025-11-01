<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '伊温 (荷叶) · 技能',
  description: '技能“焕然”生效时，还会使自标友车在6秒内提升30点急速。',
  url: 'skill/hewynn',
  locale: 'zh',
  keywords: ['Hewynn', '伊温', '荷叶'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>伊温 (荷叶)</h1>

      <h2>非永久增益</h2>

      <h3>觉醒之力</h3>
      <p>技能“焕然”生效时，还会使自标友车在[[6]]秒内提升[[30]]点急速。</p>
    </article>
  </StyledText>
</template>
