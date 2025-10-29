<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '潘多拉 · 技能',
  description:
    '战斗开始时，将最靠后的一名友军吸入魔盒中，使其处于无敌状态，但无法释放任何技能。经过4秒后，将其从魔盒内放出。若放出该友军时潘多拉依然存活，则该名友军获得1000点能量，并在接下来10秒内攻击力增加35%。',
  url: 'skill/pandora',
  locale: 'zh',
  keywords: ['Pandora', '潘多拉'],
})
</script>

<template>
  <article>
    <h1>潘多拉</h1>

    <h2>非永久增益</h2>

    <h3>技能</h3>
    <p>
      战斗开始时，将最靠后的一名友军吸入魔盒中，使其处于无敌状态，但无法释放任何技能。经过4秒后，将其从魔盒内放出。若放出该友军时潘多拉依然存活，则该名友军获得1000点能量，并在接下来10秒内攻击力增加35%。
    </p>
  </article>
</template>
