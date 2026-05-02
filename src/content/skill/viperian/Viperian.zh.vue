<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('viperian', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>维珀里安 (骨蛇)</h1>

      <h2>削能</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时，维珀里安会尽可能消耗自身生命值派出“冥蛇”附身所有敌人直至自身生命值不足[[60%]]，每派出一条“冥蛇”消耗自身[[7%]]最大生命值，在此期间处于[[霸体]]状态。每一个被“冥蛇”附身的敌人降低[[20]]点受击回能，同时需要自身每秒支付[[1%]]的生命值维持“冥蛇”的附身。当自身生命值低于[[30%]]时，召回一条“冥蛇”使自己回复[[14%]]的生命值。
      </p>

      <h3>技能</h3>
      <p>
        主动释放时，牺牲[[10%]]最大生命值使得下一次撕咬获得强化，造成[[140%]]伤害，并扣除目标[[60]]点能量。
      </p>
    </article>
  </StyledText>
</template>
