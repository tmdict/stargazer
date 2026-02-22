<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './Faramor.data'

setupSkillContentMeta('faramor', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>法拉莫尔 (白狼)</h1>

      <h2>非永久增益 (开局) · 特殊目标机制</h2>

      <h3>技能</h3>
      <p>
        备战时，选择1格范围内的一名友方英雄缔约圣言（优先选择更靠近身后的友军）。主动释放时，为自身和该英雄提升[[12%]]攻击力，持续[[10]]秒，持续时间结束后会再次释放此效果。
      </p>

      <strong>技能机制</strong>
      <p>
        法拉莫尔搜索与自己相邻格子上的友方角色，优先选择位置更靠后的角色。当同排有多个友方角色时，法拉莫尔会优先选择位置更靠右的角色（较低ID的格子）。
      </p>
      <p>当法拉莫尔处于敌方阵营时，则优先选择较高ID格子上的队友（180°旋转）。</p>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
