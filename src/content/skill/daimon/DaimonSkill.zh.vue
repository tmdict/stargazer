<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './DaimonSkill.data'

setupSkillContentMeta('daimon', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>戴蒙</h1>

      <h2>非永久增益 · 特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        备战时，戴蒙与布阵在身后的一名队友结为伙伴，每当戴蒙获得护盾时，伙伴也将获得该护盾量[[24%]]的护盾，持续时间与原护盾相同，且伙伴受到来自戴蒙的任意护盾持续期间，额外提升[[15]]点生命汲取和[[25%]]攻击力。当伙伴被击败后，戴蒙会再次选择1名[[最虚弱]]的友军结为伙伴。
      </p>

      <strong>技能机制</strong>
      <p>
        戴蒙搜索自己正后方相邻格子上的友方角色，当同排有多个友方角色时，戴蒙会优先选择位置更靠左的角色（较高ID的格子）。
      </p>
      <p>当戴蒙处于敌方阵营时，则优先选择较低ID格子上的队友（180°旋转）。</p>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        被动地，战斗中守护灵会帮助戴蒙作战，守护灵无法被攻击，会自动攻击距离戴蒙最近的敌人，对目标造成[[90%]]伤害，戴蒙被击败后守护灵也会被击败。
      </p>
    </article>
  </StyledText>
</template>
