<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('cecia', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>瑟西亚 (荆棘)</h1>

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        选择一个格子，在该位置唤醒卡莱尔先生协助作战。卡莱尔先生继承100%英雄属性，普通攻击对面前1格扇形范围内的所有敌人造成[[170%]]伤害，且最大生命值额外提高[[45%]]，但每秒失去[[4%]]最大生命值。被召唤时，卡莱尔先生会释放“苦痛缚身”：对周围2格内所有敌人施加缠绕，被缠绕的目标无法行动，且每秒受到[[140%]]伤害，持续[[2]]秒。再次使用本技能时，若卡莱尔先生已在场上，则使其回复至满血，并再次释放“苦痛缚身”。
      </p>
    </article>
  </StyledText>
</template>
