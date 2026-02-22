<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Talene.data'

setupSkillContentMeta('talene', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>塔琳 (凤凰)</h1>

      <h2>特殊目标机制</h2>

      <h3>专武技能</h3>
      <p>
        战斗开始时，为除自己外布阵[[最靠前]]的友方英雄赋予“不灭凤焰”，持续至战斗结束。“不灭凤焰”的携带者每秒会对相邻的敌人造成自身攻击力[[50%]]的伤害，并为自身恢复伤害量[[25%]]的生命。每当受“不灭凤焰”的携带者累计获得相当于自身攻击力[[500%]]的治疗时，便会在身旁产生一枚火种并将其吸收，并永久强化“不灭凤焰”，使该技能造成的伤害提高[[50%]]，最多叠加[[3]]次。
      </p>
      <p>
        <strong>4级：</strong>
        当“不灭凤焰”强化至最高层数后，当其携带者被击败时，将消耗全部“不灭凤焰”，使携带者化为一团火焰，并在[[3]]秒后以[[50%]]最大生命值重生。本效果每场战斗只能生效一次。
      </p>

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
          <strong>友方塔琳：</strong
          >从最前排开始扫描队友位置，从左到右（最高格子ID到最低），瞄准找到的第一个队友。
        </li>
        <li>
          <strong>敌方塔琳：</strong
          >以相反顺序扫描敌人位置，从右到左（最低格子ID到最高），瞄准找到的第一个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
