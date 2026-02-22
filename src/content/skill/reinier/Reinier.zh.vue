<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Reinier.data'

setupSkillContentMeta('reinier', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>雷内亚 (四手)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，若自身1格范围内存在一名友军与敌军的位置处于[[对称]]关系，雷内亚将会释放本技能使双方互换位置，优先以自身身后的友军作为目标。该敌军每次受到伤害时，该友军恢复等同于伤害量[[45%]]的生命值，持续到战斗结束。
      </p>

      <strong>技能机制</strong>
      <p>雷内亚会自动识别并标记对称，并包含友方和敌方角色的格子对。</p>
      <p>当存在多个友方敌方对时，使用以下规则处理平局：</p>
      <ul>
        <li>
          <strong>友方队伍（瞄准敌人）：</strong>相邻格子优先级：左下 → 左 → 右下 → 右 → 左上 → 右上
        </li>
        <li>
          <strong>敌方队伍（瞄准友方）：</strong>相邻格子优先级：右上 → 左上 → 右 → 右下 → 左 >
          左下（180°旋转）
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <h3>英雄专精</h3>
      <p>“动态平衡”互换的友军攻击力提升[[7%]]，互换的敌军攻击力降低[[7%]]。</p>

      <h3>专武技能</h3>
      <p>
        释放“动态平衡”时，还会对该敌人造成[[200%]]伤害并击倒，使其受到伤害提高[[25%]]，持续到战斗结束。
      </p>
      <p><strong>3级：</strong>释放“动态平衡”还会使该友军受到伤害降低[[25%]]，持续到战斗结束。</p>
    </article>
  </StyledText>
</template>
