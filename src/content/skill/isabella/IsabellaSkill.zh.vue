<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './IsabellaSkill.data'

setupSkillContentMeta('isabella', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>伊莎贝拉</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时选择[[最靠前]]的一名友方英雄作为“友人”，“友人”被击败后会重新选择。当“友人”每受到一次攻击力、攻击速度、急速、护甲、魔抗或受愈属性提升效果时，伊莎贝拉将在书中永久记录一层该属性对应的“克文”，每种属性的克文最多记录3层，“克文”带来的属性提升不会被重复记录。
      </p>
      <p>
        主动释放时，使“友人”提升[[15%]]攻击力和[[15]]点急速，持续[[6]]秒，且每层被记录的“克文”都会额外提升对应的属性（攻击力、护甲、魔抗：每层克文提高[[15%]]的属性。攻击速度、急速、受愈：每层克文提高[[15]]属性）。
      </p>

      <h2>特殊目标机制</h2>

      <strong>技能机制</strong>
      <p>
        网格被组织成水平行，第15行（格子44、45）是敌方队伍的最后排，第1行（格子1、2）是友方队伍的最后排。
      </p>
      <p>
        在同一行内，靠左（较高ID）的格子在友方一侧被认为“更靠前”，而靠右（较低ID）的格子在敌方一侧被认为“更靠前”。
      </p>
      <p>最靠前角色是根据他们在地图上的位置确定的：</p>
      <ul>
        <li>
          <strong>友方伊莎贝拉：</strong
          >从最前排开始扫描队友位置，从左到右（最高格子ID到最低），瞄准找到的第一个队友。
        </li>
        <li>
          <strong>敌方伊莎贝拉：</strong
          >以相反顺序扫描敌人位置，从右到左（最低格子ID到最高），瞄准找到的第一个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
