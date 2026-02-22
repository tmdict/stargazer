<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('velara', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>奎茵</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时，奎茵在战场上召唤[[4]]个法阵，每个法阵累计获得[[1000]]能量后会被点亮。法阵被点亮后，使周围2格内所有友军每秒回复奎茵[[40%]]的生命值、所有敌军降低[[30]]点急速。
      </p>
      <p>
        主动释放时，奎茵消耗自身的能量给目标法阵充能直到它被点亮。若所有法阵均被点亮，将法阵的影响范围扩大到全场，同时降低全场敌人[[30%]]的[[基础属性]]并将其平均转移给我方角色，持续[[10]]秒；每名我方角色获得的转移属性上限为奎茵对应初始属性的[[45%]]（在挑战首领的模式中，改为固定达到该上限）。
      </p>

      <strong>技能机制</strong>
      <p>格位增益效果视为非永久增益效果。</p>
    </article>
  </StyledText>
</template>
