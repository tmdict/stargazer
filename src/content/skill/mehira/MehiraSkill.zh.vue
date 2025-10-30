<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '梅希拉 (魅魔) · 技能',
  description:
    '梅希拉不分敌我地挥动鞭子鞭笞前方半径3格扇形区域内的角色5次，每次鞭笞使其流失20%的生命。若命中友军，则额外提高其急速25点，持续8秒。该技能对友军造成的生命流失效果降低90%，并且选择能命中最多敌人的方向释放。',
  url: 'skill/mehira',
  locale: 'zh',
  keywords: ['Mehira', '梅希拉', '魅魔'],
})
</script>

<template>
  <article>
    <h1>梅希拉 (魅魔)</h1>

    <h2>非永久增益</h2>

    <h3>技能</h3>
    <p>
      梅希拉不分敌我地挥动鞭子鞭笞前方半径3格扇形区域内的角色5次，每次鞭笞使其流失20%的生命。若命中友军，则额外提高其急速25点，持续8秒。该技能对友军造成的生命流失效果降低90%，并且选择能命中最多敌人的方向释放。
    </p>
  </article>
</template>
