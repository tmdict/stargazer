<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('zandrok', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>赞东 (人马)</h1>

      <h2>非永久增益 (开局)</h2>

      <h3>技能</h3>
      <p>
        战斗开始时，召唤5格宽度的自身虚影朝敌方阵营方向冲锋，破坏沿途的阻挡，对敌人造成[[10%]]伤害，并鼓舞沿途的所有友军。赞东和被鼓舞的其他友军分别永久提升[[50%]]和[[20%]]最大生命值（当前生命值保持不变），并在后续的[[8]]秒内提升[[40]]点生命汲取，[[20]]点急速与[[100%]]移动速度。
      </p>
      <p>
        主动使用时，鼓舞周围2格范围内的友军，使其获得[[25]]点生命汲取和[[14]]点急速，持续[[8]]秒，不可叠加。
      </p>
    </article>
  </StyledText>
</template>
