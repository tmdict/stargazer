<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Isabella.data'

setupSkillContentMeta('isabella', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>伊莎贝拉</h1>

      <h2>非永久增益 · 特殊目标机制</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时选择[[最靠前]]的一名友方英雄作为“友人”，“友人”被击败后会重新选择。当“友人”每受到一次攻击力、攻击速度、急速、护甲、魔抗或受愈属性提升效果时，伊莎贝拉将在书中永久记录一层该属性对应的“克文”，每种属性的克文最多记录3层，“克文”带来的属性提升不会被重复记录。
      </p>
      <p>
        主动释放时，使“友人”提升[[15%]]攻击力和[[15]]点急速，持续[[6]]秒，且每层被记录的“克文”都会额外提升对应的属性（攻击力、护甲、魔抗：每层克文提高[[15%]]的属性。攻击速度、急速、受愈：每层克文提高[[15]]属性）。
      </p>

      <strong>技能机制</strong>
      <p>
        网格由多个横排组成，第15排（格子44、45）为敌方队伍的最后一排，第1排（格子1、2）为友方队伍的最后一排。
      </p>
      <p>
        同一排内，靠左侧（ID较大）的格子在友方一侧视为“更靠前”，靠右侧（ID较小）的格子在敌方一侧视为“更靠前”。
      </p>
      <p>最靠前的角色根据其在战场上的位置确定：</p>
      <ul>
        <li>
          <strong>友方伊莎贝拉：</strong
          >从最前排开始扫描友军位置，从左到右（格子ID从大到小），锁定找到的第一个友军。
        </li>
        <li>
          <strong>敌方伊莎贝拉：</strong
          >按相反顺序扫描敌人位置，从右到左（格子ID从小到大），锁定找到的第一个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
