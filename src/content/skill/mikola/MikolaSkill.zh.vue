<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '曼卡拉 (猴女) · 技能',
  description:
    '摇晃铃铛，为自己和另外2名最虚弱的友军恢复130%生命值，并使其护甲与魔抗提高40%，持续5秒。',
  url: 'skill/mikola',
  locale: 'zh',
  keywords: ['Mikola', '曼卡拉', '猴女'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>曼卡拉 (猴女)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，在战场中央生成一座横跨战场的荣耀擂台，持续至战斗结束。当荣耀擂台范围内的敌我其中一方的单位数量超过另一方时，便会开始抢夺荣耀擂台，并在维持人数优势[[3]]秒后获得荣耀擂台的控制权。
      </p>
      <p>当己方控制荣耀擂台时，己方全体单位提升[[14%]]攻击力，并且每秒恢复[[12%]]生命值。</p>

      <strong>技能机制</strong>
      <p>格位增益效果视为非永久增益效果。</p>

      <h3>技能</h3>
      <p>
        摇晃铃铛，为自己和另外[[2]]名[[最虚弱的]]友军恢复[[130%]]生命值，并使其护甲与魔抗提高[[40%]]，持续[[5]]秒。
      </p>
    </article>
  </StyledText>
</template>
