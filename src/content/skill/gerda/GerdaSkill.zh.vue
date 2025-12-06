<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '格尔达 (熊女) · 技能',
  description:
    '战斗开始时向前跳跃最多3格，猛踩地面打通泉眼，对周围1格敌军造成200%伤害并附带打断效果，随后使自身周围2格被覆盖为温泉区域，处于温泉区域的友军每秒恢复25%生命值，处于温泉区域的敌人每秒恢复4%的生命（不超过该敌人0.5%最大生命值。技能施法期间处于霸体状态。',
  url: 'skill/gerda',
  locale: 'zh',
  keywords: ['Gerda', '格尔达', '熊女'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>格尔达 (熊女)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        战斗开始时向前跳跃最多3格，猛踩地面打通泉眼，对周围1格敌军造成[[200%]]伤害并附带打断效果，随后使自身周围2格被覆盖为温泉区域，处于温泉区域的友军每秒恢复[[25%]]生命值，处于温泉区域的敌人每秒恢复[[4%]]的生命（不超过该敌人[[0.5%]]最大生命值。技能施法期间处于[[霸体]]状态。
      </p>
    </article>
  </StyledText>
</template>
