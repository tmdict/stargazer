<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '缇洛亚 · 技能',
  url: 'skill/velara',
  locale: 'zh',
  keywords: ['Velara', '奎茵'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>洛桑 (兔男)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        为[[最虚弱的]]友军施加持续[[6]]秒的“风愈之护”，在此期间，该友军获得[[50闪避率]]和[[30]]点急速，并且每秒回复[[90%]]的生命值。
      </p>
    </article>
  </StyledText>
</template>
