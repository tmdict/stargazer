<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Frieren.data'

setupSkillContentMeta('frieren', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>芙莉莲</h1>

      <h2>特殊目标机制</h2>

      <h3>专武技能</h3>
      <p>
        战斗开始时，芙莉莲为自身和[[最靠前]]的一名友军施展防御魔法，当他们受到超过其[[10%]]初始最大生命值的伤害时，会使超出部分的伤害降低[[75%]]。
      </p>
      <p><strong>3级：</strong>[[最靠前]]的这名友军存活期间，芙莉莲额外提升[[35]]点急速。</p>

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
          <strong>友方芙莉莲：</strong
          >从最前排开始扫描友军位置，从左到右（格子ID从大到小），锁定找到的第一个友军。
        </li>
        <li>
          <strong>敌方芙莉莲：</strong
          >按相反顺序扫描敌人位置，从右到左（格子ID从小到大），锁定找到的第一个敌人。
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
