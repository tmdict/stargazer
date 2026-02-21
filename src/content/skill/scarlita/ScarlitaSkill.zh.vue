<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('scarlita', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>斯克嘉丽德 (神斧)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        处于空中时，斯克嘉莉德每次对[[最虚弱的]]非召唤物友军发动1次护佑，使目标获得持续[[3]]秒的护盾，护盾值为斯克嘉莉德[[15%]]。
      </p>

      <h3>觉醒之力</h3>
      <p>
        <strong>2级：</strong
        >技能“天影神裁”期间，若一名友军生命值比例低于[[20%]]，立即为其施加一个可抵御[[120%]]伤害的护盾，持续[[10]]秒，该效果每场战斗至多触发一次。
      </p>
    </article>
  </StyledText>
</template>
