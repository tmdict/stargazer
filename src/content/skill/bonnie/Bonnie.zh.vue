<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Bonnie.data'

setupSkillContentMeta('bonnie', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>波妮</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，波妮对最靠后的敌人施加“衰老”魔法，对其造成[[150%]]伤害并使其降低[[30]]点急速，持续到战斗结束，波妮会优先攻击这名敌人。
      </p>

      <strong>技能机制</strong>
      <p>
        网格由多个横排组成，第15排（格子44、45）为敌方队伍的最后一排，第1排（格子1、2）为友方队伍的最后一排。
      </p>
      <p>
        同一排内，靠左侧（ID较大）的格子在友方一侧视为“更靠前”，靠右侧（ID较小）的格子在敌方一侧视为“更靠前”。
      </p>
      <p>最靠后的角色根据其在战场上的位置确定：</p>
      <ul>
        <li>
          <strong>友方波妮：</strong
          >从最后排开始扫描敌人位置，从左到右（最高格子ID到最低），瞄准找到的第一个敌人。
        </li>
        <li>
          <strong>敌方波妮：</strong
          >以相反顺序扫描队友位置，从右到左（最低格子ID到最高），瞄准找到的第一个队友。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
