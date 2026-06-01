<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Aliceth.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title="目标选择（友方）">
        <p>
          亚莉克希首先检查与她同排的队友。当同排有多个队友时，亚莉克希会选择距离更近的队友，当距离相同时，优先选择位置更靠左的角色（较高ID的格子）。
        </p>
        <p>当同排没有队友时，亚莉克希会搜索与她相邻格子上的角色，并向外扩展：</p>
        <ul>
          <li><strong>第1环：</strong>紧邻的6个格子，从最前排到最后排，从左到右。</li>
          <li><strong>第2环：</strong>距离为2的12个格子，从最前排到最后排，从左到右。</li>
          <li>以此类推...</li>
        </ul>
        <div style="text-align: center">
          <GridSnippet :grid-style="gridStyles.rowScan1" :images layout="inline" />
          <GridSnippet :grid-style="gridStyles.rowScan2" :images layout="inline" />
        </div>
        <p>
          另一种理解方式：亚莉克希从与她相邻的格子开始扫描，向外扩展，按照从最高格子ID到最低ID的顺序，锁定找到的第一个队友。
        </p>
        <p>
          敌方亚莉克希锁定队友时，此行为会被翻转（180°旋转）。亚莉克希会从右侧（较低ID）扫描到左侧（较高ID）。
        </p>
      </SkillSnippet>
      <SkillSnippet title="目标选择（敌方）">
        <p>亚莉克希会自动识别并锁定距离她所在格子最远的对手。</p>
        <p>距离计算使用六边形网格距离来确定最远的对手。</p>
        <p>当多个对手距离相等时：</p>
        <ul>
          <li><strong>友方亚莉克希：</strong>优先选择格子ID较小的对手</li>
          <li><strong>敌方亚莉克希：</strong>优先选择格子ID较大的对手（180°旋转）</li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
