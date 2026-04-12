<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('alna', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>赫普 (枭熊)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>“本相”形态：赫普对[[最虚弱的]]友军施加治愈术，使目标在[[6]]秒内每秒恢复[[130%]]生命值。</p>
      <p>
        “变形”形态：赫普对[[最虚弱的]][[3]]名友军施加治愈术和坚硬皮肤，使目标在[[6]]秒内每秒恢复[[130%]]生命值，并使其获得[[400%]]护盾，持续[[15]]秒。
      </p>
    </article>
  </StyledText>
</template>
