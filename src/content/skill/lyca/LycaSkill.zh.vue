<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lyca', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>莱卡 (兔弓)</h1>

      <h2>非永久增益 (开局) · 充能</h2>

      <h3>技能</h3>
      <p>
        星辰降下祝福，为所有友军提升[[25]]点攻击速度，持续[[6]]秒。战斗开始时会立即使用一次，额外使每名友军回复[[120]]点能量。
      </p>

      <h3>觉醒之力</h3>
      <p><strong>2级：</strong>额外获得[[300]]点初始能量。</p>
    </article>
  </StyledText>
</template>
