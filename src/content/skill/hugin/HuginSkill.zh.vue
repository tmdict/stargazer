<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '呼金 · 技能',
  description:
    '主动释放时，为累计造成伤害最高的友军锻造机械齿轮，使其攻击力提升，提升值等同于呼金6%的基础攻击力，且急速提高80点，持续10秒。',
  url: 'skill/hugin',
  locale: 'zh',
  keywords: ['Hugin', '呼金'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>呼金</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        主动释放时，为累计造成伤害最高的友军锻造机械齿轮，使其攻击力提升，提升值等同于呼金6%的基础攻击力，且急速提高[[80]]点，持续[[10]]秒。
      </p>

      <h3>技能</h3>
      <p>为最虚弱的友军锻造齿轮护甲，使其获得可抵御[[600%]]伤害的护盾，持续[[8]]秒。</p>
      <p>
        战斗开始时，呼金在[[身后一格]]布置机械联动装置。处于联动装置之上的友军的攻击力获得提升，提升值等同于呼金[[14%]]的基础攻击力，还会在呼金释放“神奇盾甲”时，获得传导的动能，额外回复[[75]]点能量。该效果在友军离开联动装置后消失。
      </p>

      <h3>专武技能</h3>
      <p>
        释放终极技能时，额外为最虚弱的2名友军锻造改良型齿轮护甲，使其获得可抵御[[800%]]伤害的护盾，持续[[8]]秒。
      </p>
    </article>
  </StyledText>
</template>
