<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('rowan', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>罗万 (商人)</h1>

      <h2>充能</h2>

      <h3>终极技能</h3>
      <p>
        移动至多[[1]]格，并在抵达目的地后持续抛酒金币，使周围2格范围内的其他友军回复共[[250]]点能量。
      </p>

      <h3>技能</h3>
      <p>
        <strong>3级：</strong>
        战斗开始时，在推车上额外布置1瓶“能量药剂”，自身周围[[2]]格内的其他友军在能量高于[[600]]时，会自动使用“能量药剂”，回复[[400]]点能量。
      </p>
    </article>
  </StyledText>
</template>
