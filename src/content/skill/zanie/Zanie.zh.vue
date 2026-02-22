<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('zanie', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>祖娅</h1>

      <h2>召唤</h2>

      <h3>技能</h3>
      <p>
        被动地，战斗开始时在自身面前一格建造一个机枪塔，继承自身[[70%]]的最大生命值和攻击力。机枪塔拥有3格攻击距离，且优先攻击范围内最靠近激光塔的敌人，每次普通攻击造成机枪塔攻击力[[100%]]的伤害。
      </p>

      <strong>技能机制</strong>
      <p>祖娅在备战阶段放置的2个激光塔不算作召唤物。</p>
    </article>
  </StyledText>
</template>
