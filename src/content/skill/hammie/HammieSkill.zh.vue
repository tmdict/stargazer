<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hammie', 'zh')
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
