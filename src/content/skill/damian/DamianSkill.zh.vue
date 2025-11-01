<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '达米安 (小羊) · 技能',
  description:
    '被动地，达米安在战斗中不会被攻击，战斗开始时会在布阵位置打造一辆玩具车，继承自身85%的生命值和100%的其他属性，随后自身退至场外，并会在场上其他友军全部被击败后撤离战场。',
  url: 'skill/damian',
  locale: 'zh',
  keywords: ['Damian', '达米安', '小羊'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>达米安 (小羊)</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        被动地，达米安在战斗中不会被攻击，战斗开始时会在布阵位置打造一辆玩具车，继承自身[[85%]]的生命值和[[100%]]的其他属性，随后自身退至场外，并会在场上其他友军全部被击败后撤离战场。
      </p>

      <h3>专武技能</h3>
      <p>
        每一辆玩具车在首次响应“紧急救援！”时会展开音乐光环，对周围[[2]]格的非召唤物友军进行鼓舞，提升其[[40]]点急速，持续[[10]]秒。
      </p>
    </article>
  </StyledText>
</template>
