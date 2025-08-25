<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './BonnieSkill.data'

setupContentMeta({
  title: '波妮 · 黯影衰朽',
  description: '战斗开始时，波妮对最靠后的敌人施加“衰老”魔法。对其造成伤害和DoT（持续伤害）。',
  url: 'skill/bonnie',
  locale: 'zh',
  keywords: ['Bonnie', '波妮'],
})
</script>

<template>
  <article>
    <h1>波妮 · 黯影衰朽</h1>
    <p>战斗开始时，波妮对最靠后的敌人施加“衰老”魔法。对其造成伤害和DoT（持续伤害）。</p>

    <h2>技能机制</h2>
    <p>
      网格被组织成水平行，第15行（格子44、45）是敌方队伍的最后排，第1行（格子1、2）是友方队伍的最后排。
    </p>
    <p>
      在同一行内，靠左（较高ID）的格子在敌方一侧被认为“更靠后”，而靠右（较低ID）的格子在友方一侧被认为“更靠后”。
    </p>
    <p>最后排角色是根据他们在地图上的位置确定的：</p>
    <ul>
      <li>
        <strong>友方波妮：</strong
        >从最后排开始扫描敌人位置，从左到右（最高格子ID到最低），瞄准找到的第一个敌人。
      </li>
      <li>
        <strong>敌方波妮：</strong
        >以相反顺序扫描盟友位置，从右到左（最低格子ID到最高），瞄准找到的第一个盟友。
      </li>
    </ul>

    <GridSnippet :grid-style="gridStyles.main" :images />
  </article>
</template>
