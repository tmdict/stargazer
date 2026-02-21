<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '缇洛亚 · 技能',
  url: 'skill/tilaya',
  locale: 'zh',
  keywords: ['Tilaya', '缇洛亚'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>缇洛亚</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        被动地，战斗开始时自身失去[[70%]]的生命值，获得至多可抵御[[120%]]伤害的“树藤之护”护盾，“树藤之护”每秒自动恢复[[10%]]的护盾值，其存在时自身处于[[霸体]]状态。“树藤之护”被击破时，进入[[3]]秒的冷却，冷却结束后“树藤之护”护盾量直接恢复至[[45%]]。
      </p>

      <h3>专武技能</h3>
      <p>
        <strong>3级：</strong
        >“树藤之护”累计存在[[15]]秒后，增强与植物的共鸣，使处于自身2格范围内所有友军提升[[40%]]的最大生命值和[[60%]]护甲魔抗。友军通过本技能获得的最大生命值不超过缇洛亚自身初始最大生命值的[[80%]]。
      </p>
    </article>
  </StyledText>
</template>
