<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
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
  <StyledText>
    <article>
      <h1>潘多拉</h1>

      <h2>充能 · 非永久增益</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，将[[最靠后]]的一名友军吸入魔盒中，使其处于[[无敌]]状态，但无法释放任何技能。经过[[4]]秒后，将其从魔盒内放出。若放出该友军时潘多拉依然存活，则该名友军获得[[1000]]点能量，并在接下来[[10]]秒内攻击力增加[[35%]]。
      </p>
      <p>
        被动地，潘多拉每次释放普通攻击以外的技能时，为从魔盒中放出的友军恢复[[290%]]生命值和[[90]]点能量。
      </p>
    </article>
  </StyledText>
</template>
