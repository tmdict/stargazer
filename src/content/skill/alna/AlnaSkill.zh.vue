<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '阿尔娜 (冬喉) · 技能',
  description:
    '布阵时与阿尔娜处于同排的一名友军将晋升为“凛冬战士”，“凛冬战士”免疫“凛冬战歌”带来的急速减益效果，并且永久提高15%生命上限。',
  url: 'skill/alna',
  locale: 'zh',
  keywords: ['Alna', '阿尔娜', '冬喉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>阿尔娜 (冬喉)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        布阵时与阿尔娜处于同排的一名友军将晋升为“凛冬战士”，“凛冬战士”免疫“凛冬战歌”带来的急速减益效果，并且永久提高[[15%]]生命上限。
      </p>

      <h3>专武技能</h3>
      <p>
        战斗开始时和后续每隔[[20]]秒，阿尔娜呼唤寒风环绕保护自身，使自身免疫伤害与控制效果，持续[[4]]秒。
      </p>
      <p>
        <strong>3级：</strong
        >主动释放“摄人寒意”时的效果将同样对“凛冬战士”生效，当阿尔娜或“凛冬战士”的生命值首次低于[[50%]]时，将会额外触发一次“摄人寒意”，该效果每人每场战斗中最多触发[[1]]次。
      </p>
    </article>
  </StyledText>
</template>
