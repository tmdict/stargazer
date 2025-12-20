<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './GalahadSkill.data'

setupContentMeta({
  title: '加拉哈德 (加拉) · 技能',
  description:
    '对最虚弱的友军施加巫术庇护，为其添加480%的护盾持续8秒，护盾在消失时对周围1格范围内的敌人造成240%伤害。',
  url: 'skill/galahad',
  locale: 'zh',
  keywords: ['Galahad', '加拉哈德', '加拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>加拉哈德 (加拉)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        对[[最虚弱的]]友军施加巫术庇护，为其添加[[480%]]的护盾持续[[8]]秒，护盾在消失时对周围1格范围内的敌人造成[[240%]]伤害。
      </p>

      <h2>特殊目标机制</h2>

      <h3>专武技能</h3>
      <p>
        战斗开始时标记布阵时距离自己最近的一名友方英雄（相同距离下优先选择更靠近自己身后的友方英雄）。当加拉哈德终极技能展开的魔法阵首次激活度达到100%时，召唤该友军战斗开始时的残影持续[[12]]秒，残影继承其本体[[80%]]的基础属性，具有额外[[400]]点初始能量，不算作存活英雄且不会被敌人攻击。
      </p>

      <h3>技能机制</h3>
      <p>
        加拉哈德首先检查与她相邻格子上的友方角色，并向外扩展，优先选择位置更靠后的角色。当同排有多个友方角色时，加拉哈德会优先选择位置更靠右的角色（较低ID的格子）：
      </p>
      <ul>
        <li><strong>第1环：</strong>紧邻的6个格子，从最后排到最前排，从右到左（较低ID的格子）。</li>
        <li>
          <strong>第2环：</strong>距离为2的12个格子，从最后排到最前排，从右到左（较低ID的格子）。
        </li>
        <li>以此类推...</li>
      </ul>
      <p>当加拉哈德处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
