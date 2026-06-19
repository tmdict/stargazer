<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Evie.data'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-targeting">
        <p>
          战斗开始时，伊芙会瞄准她的对称格子（穿过棋盘中心的镜像位置）。目标格子为她的对称格子及其周围的6个格子。
        </p>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.enemyTarget1" :images layout="inline" />
          <GridSnippet :grid-style="gridStyles.enemyTarget2" :images layout="inline" />
        </div>
      </SkillSnippet>
    </template>
    <template #skill3>
      <SkillSnippet title-key="guide-targeting">
        <p>战斗开始时，伊芙的羽毛笔会跟随最靠后的友军（即布阵中最靠后的队友），不包括伊芙自己。</p>
        <p>最靠后根据格子ID确定：</p>
        <ul>
          <li><strong>友方伊芙：</strong>格子ID最小的友军。</li>
          <li><strong>敌方伊芙：</strong>格子ID最大的友军（180°旋转）。</li>
        </ul>
        <p>瞄准箭头仅显示初始目标，随着战斗进行，羽毛笔之后会转移到累计输出最高的友军身上。</p>
        <GridSnippet :grid-style="gridStyles.allyTarget" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
