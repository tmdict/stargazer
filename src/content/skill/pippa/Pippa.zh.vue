<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('pippa', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>皮帕 (松鼠)</h1>

      <h2>削能</h2>

      <h3>技能</h3>
      <p>
        选择敌方最密集的区域生成半径1格的魔法植物持续3秒，持续期间每秒对范围内敌人造成[[140%]]伤害并扣除[[150]]点能量。该技能“失控”时，魔法植物只会存在1秒，不好植物枯萎了！
      </p>
    </article>
  </StyledText>
</template>
