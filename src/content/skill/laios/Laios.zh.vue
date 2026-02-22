<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('laios', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>莱欧斯</h1>

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        在身边召唤一具行动缓慢但具有无限生命值的会动的铠甲并交由剑助操纵。会动的铠甲有1000点能量，且其攻击会造成莱欧斯攻击力[[300%]]的伤害。会动的铠甲存在期间每秒扣除[[25]]点能量，并且当会动的铠甲承受原始伤害量超过施法者[[250%]]攻击比例的伤害时，会额外扣除[[100]]点能量。当能量耗尽后，会动的铠甲会原地解体，每秒恢复[[125]]点能量，直至能量回满后再次投入战斗。后续释放本技能时，将会立即为剑助恢复1000点能量，并使其在接下来的[[10]]秒内提高[[120]]点攻击速度并免疫控制效果。
      </p>
    </article>
  </StyledText>
</template>
