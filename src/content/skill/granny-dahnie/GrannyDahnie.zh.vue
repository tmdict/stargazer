<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('granny-dahnie', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>达赫妮婆婆 (婆婆)</h1>

      <h2>削能</h2>

      <h3>终极技能</h3>
      <p>
        在自身周围2格范围内召唤寄生草地，持续3秒，寄生草地范围内的敌军无法行动，每秒失去[[25]]点能量。范围内的所有敌军每秒还会失去总计[[130%]]的生命值，并且每个敌军至少失去[[60%]]生命值，达赫妮婆婆自身会回复等量的生命值。技能持续期间达赫妮婆婆处于[[霸体]]状态。
      </p>
    </article>
  </StyledText>
</template>
