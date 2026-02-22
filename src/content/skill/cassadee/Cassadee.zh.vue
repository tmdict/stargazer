<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Cassadee.data'

setupSkillContentMeta('cassadee', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>科丝蒂 (水法)</h1>

      <h2>特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，选择布阵时距离自己最近的一名友军（相同距离下优先选择更靠近自己身后的友军），为其施加“潮汐之力”祝福。每当受祝福友军的普通攻击命中敌人时，科丝蒂将对这名敌人额外造成一次[[60%]]魔法伤害。累计触发[[9]]次效果后，该祝福效果将会消失，科丝蒂会在[[9]]秒冷却时间过后再次对该友军施加祝福。该祝福效果无法被驱散。
      </p>

      <strong>技能机制</strong>
      <p>
        科丝蒂从与她相邻的格子开始搜索友方角色，并向外扩展，优先选择位置更靠后的角色。当同排有多个友方角色时，科丝蒂会优先选择位置更靠右的角色（较低ID的格子）：
      </p>
      <ul>
        <li><strong>第1环：</strong>紧邻的6个格子，从最后排到最前排，从右到左（较低ID的格子）。</li>
        <li>
          <strong>第2环：</strong>距离为2的12个格子，从最后排到最前排，从右到左（较低ID的格子）。
        </li>
        <li>以此类推...</li>
      </ul>
      <p>当科丝蒂处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
