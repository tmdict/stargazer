<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '戈丹 · 技能',
  description:
    '主动使用时，戈丹选择1格范围内的1名敌人，举起大剑挑战对方，使对方定身5秒，同时生成一个两人为中心的斗猎围场，对其中的所有敌人造成180%伤害，并且击退围场内的其余远程敌人。',
  url: 'skill/kordan',
  locale: 'zh',
  keywords: ['Kordan', '戈丹'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>埃隆 (绿剑)</h1>

      <h2>开局开大招</h2>

      <h3>终极技能</h3>
      <p>
        主动使用时，戈丹选择[[1]]格范围内的[[1]]名敌人，举起大剑挑战对方，使对方定身[[5]]秒，同时生成一个两人为中心的斗猎围场，对其中的所有敌人造成[[180%]]伤害，并且击退围场内的其余远程敌人。
      </p>
    </article>
  </StyledText>
</template>
