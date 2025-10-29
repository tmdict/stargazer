<script setup lang="ts">
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
  <article>
    <h1>潘多拉</h1>

    <h2>非永久增益</h2>

    <h3>终极技能</h3>
    <p>
      主动释放时，为累计造成伤害最高的友军锻造机械齿轮，使其攻击力提升，提升值等同于呼金6%的基础攻击力，且急速提高80点，持续10秒。
    </p>

    <h3>技能</h3>
    <p>为最虚弱的友军锻造齿轮护甲，使其获得可抵御🗡️600%伤害的护盾，持续8秒。</p>

    <h3>专武技能</h3>
    <p>
      释放终极技能时，额外为最虚弱的2名友军锻造改良型齿轮护甲，使其获得可抵御800%伤害的护盾，持续8秒。
    </p>
  </article>
</template>
