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
      <h1>戈丹</h1>

      <h2>开局开大招 · 非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        主动使用时，戈丹选择[[1]]格范围内的[[1]]名敌人，举起大剑挑战对方，使对方定身[[5]]秒，同时生成一个两人为中心的斗猎围场，对其中的所有敌人造成[[180%]]伤害，并且击退围场内的其余远程敌人。
      </p>
      <p>
        斗猎围场持续[[16]]秒，在其范围内的所有角色受到来自外部的治疗和伤害都降低[[60%]]。我方角色在斗猎围场内额外增加[[20%]]攻击力和[[40]]点生命汲取，并且造成伤害提升[[20%]]。同一时间戈丹只能维持一个斗猎围场。该技能初始拥有1000能量。
      </p>

      <strong>技能机制</strong>
      <p>格位增益效果视为非永久增益效果。</p>
    </article>
  </StyledText>
</template>
