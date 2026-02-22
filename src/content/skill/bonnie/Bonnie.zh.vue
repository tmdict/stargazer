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
          >以相反顺序扫描队友位置，从右到左（最低格子ID到最高），瞄准找到的第一个队友。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
