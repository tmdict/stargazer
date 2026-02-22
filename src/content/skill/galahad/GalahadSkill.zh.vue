<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './GalahadSkill.data'

setupSkillContentMeta('galahad', 'zh')
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

      <h2>召唤 · 特殊目标机制</h2>

      <h3>终极技能</h3>
      <p>
        使用终极技能时，立即消耗[[400]]点能量，对所有敌人造成[[340%]]伤害，随后在自身位置展开半径2格的魔法阵持续至自身离开其中心位置。魔法阵持续期间每秒消耗加拉哈德[[60]]点能量以提高10%激活度，激活度达到100%后不再消耗能量并使加拉哈德提高[[30]]点急速。魔法阵每有10%激活度，使区域内的敌人降低[[10]]点急速和[[16%]]移动速度，最多降低[[50]]点急速和[[80%]]移动速度。加拉哈德位于魔法阵中心释放技能后会召唤自身残影再次释放该技能，残影继承自身[[60%]]属性。
      </p>

      <h3>专武技能</h3>
      <p>
        战斗开始时标记布阵时距离自己最近的一名友方英雄（相同距离下优先选择更靠近自己身后的友方英雄）。当加拉哈德终极技能展开的魔法阵首次激活度达到100%时，召唤该友军战斗开始时的残影持续[[12]]秒，残影继承其本体[[80%]]的基础属性，具有额外[[400]]点初始能量，不算作存活英雄且不会被敌人攻击。
      </p>

      <strong>技能机制</strong>
      <p>
        加拉哈德从与她相邻的格子开始搜索友方角色，并向外扩展，优先选择位置更靠后的角色。当同排有多个友方角色时，加拉哈德会优先选择位置更靠右的角色（较低ID的格子）：
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

      <p>
        加拉哈德只会选择本体角色为目标，跳过召唤物和分身，例如蝎子的分身或双子的副体（粉色双子）。
      </p>
    </article>
  </StyledText>
</template>
