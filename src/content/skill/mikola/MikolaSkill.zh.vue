<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '曼卡拉 (猴女) · 技能',
  description:
    '摇晃铃铛，为自己和另外2名最虚弱的友军恢复130%生命值，并使其护甲与魔抗提高40%，持续5秒。',
  url: 'skill/mikola',
  locale: 'zh',
  keywords: ['Mikola', '曼卡拉', '猴女'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>曼卡拉 (猴女)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        摇晃铃铛，为自己和另外[[2]]名[[最虚弱的]]友军恢复[[130%]]生命值，并使其护甲与魔抗提高[[40%]]，持续[[5]]秒。
      </p>
    </article>
  </StyledText>
</template>
