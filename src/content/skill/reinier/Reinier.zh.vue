<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Reinier.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>雷内亚会自动识别并标记对称，并包含友方和敌方角色的格子对。</p>
        <p>当存在多个友方敌方对时，使用以下规则处理平局：</p>
        <ul>
          <li>
            <strong>友方队伍（瞄准敌人）：</strong>相邻格子优先级：左下 → 左 → 右下 → 右 → 左上 →
            右上
          </li>
          <li>
            <strong>敌方队伍（瞄准友方）：</strong>相邻格子优先级：右上 → 左上 → 右 → 右下 → 左 →
            左下（180°旋转）
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
