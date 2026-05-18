<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Pandora.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>
          网格由多个横排组成，第15排（格子44、45）为敌方队伍的最后一排，第1排（格子1、2）为友方队伍的最后一排。
        </p>
        <p>
          同一排内，靠左侧（ID较大）的格子在友方一侧视为"更靠前"，靠右侧（ID较小）的格子在敌方一侧视为"更靠前"。
        </p>
        <p>最靠后的角色根据其在战场上的位置确定：</p>
        <ul>
          <li>
            <strong>友方潘多拉：</strong
            >从最后排开始扫描友方位置，从右到左（最低格子ID到最高），瞄准找到的第一个队友。
          </li>
          <li>
            <strong>敌方潘多拉：</strong
            >以相反顺序扫描敌方位置，从左到右（最高格子ID到最低），瞄准找到的第一个队友。
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
