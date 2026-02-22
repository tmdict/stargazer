<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('mehira', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>梅希拉 (魅魔)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        梅希拉不分敌我地挥动鞭子鞭笞前方半径[[3]]格扇形区域内的角色[[5]]次，每次鞭笞使其流失[[20%]]的生命。若命中友军，则额外提高其急速[[25]]点，持续[[8]]秒。该技能对友军造成的生命流失效果降低[[90%]]，并且选择能命中最多敌人的方向释放。
      </p>
    </article>
  </StyledText>
</template>
