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
      <h1>戴蒙</h1>

      <h2>非永久增益 · 特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        备战时，戴蒙与布阵在身后的一名队友结为伙伴，每当戴蒙获得护盾时，伙伴也将获得该护盾量[[24%]]的护盾，持续时间与原护盾相同，且伙伴受到来自戴蒙的任意护盾持续期间，额外提升[[15]]点生命汲取和[[25%]]攻击力。当伙伴被击败后，戴蒙会再次选择1名[[最虚弱]]的友军结为伙伴。
      </p>
    </article>
  </StyledText>
</template>
