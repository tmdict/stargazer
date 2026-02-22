<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('thador', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>都铎</h1>

      <h2>充能</h2>

      <h3>技能</h3>
      <p>备战时，选择身后一格的友军作为副手，自身存活时，副手获得15点暴击。</p>

      <h3>专武技能</h3>
      <p><strong>3级：</strong> 副手在战斗开始时获得[[350]]点能量。</p>
    </article>
  </StyledText>
</template>
