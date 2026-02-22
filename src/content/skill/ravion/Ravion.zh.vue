<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Ravion.data'

setupSkillContentMeta('ravion', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>沙利叶</h1>

      <h2>非永久增益 (开局) · 特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，为[[最靠后]]的[[2]]名友军发放任务牌，当其累计对敌人造成沙利叶初始攻击力[[2000%]]的伤害或[[参与击败]]敌人后，任务完成。完成任务的角色立刻恢复[[150]]能量并使自身获得沙利叶初始攻击力的[[12%]]，持续[[30]]秒。
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
          <strong>友方沙利叶：</strong
          >从最后排开始扫描队友位置，从右到左（最低格子ID到最高），瞄准找到的前两个队友。
        </li>
        <li>
          <strong>敌方沙利叶：</strong
          >以相反顺序扫描敌人位置，从左到右（最高格子ID到最低），瞄准找到的前两个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <h3>觉醒之力</h3>
      <p>队友在接受任务牌时获得[[15%]]攻击力提升和[[霸体]]，持续[[5]]秒。</p>
    </article>
  </StyledText>
</template>
