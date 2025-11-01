<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '阿熏和蒙蒙 (奶爸) · 技能',
  description: '战斗开始后，在自己周围2格范围内制造并持续施法维持香薰。',
  url: 'skill/smokey-meerky',
  locale: 'zh',
  keywords: ['Smokey & Meerky', '阿熏和蒙蒙', '奶爸'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>阿熏和蒙蒙 (奶爸)</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>战斗开始后，在自己周围2格范围内制造并持续施法维持香薰。</p>

      <h3>技能</h3>
      <p>香薰内的友车提升[[16%]]攻击力。</p>
    </article>
  </StyledText>
</template>
