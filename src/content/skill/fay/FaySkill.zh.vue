<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('fay', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>菲</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        选择一个方向，为面前3格扇形范围内的友军恢复[[300%]]的生命值，并在该区域内施加元气魔法，使其中的友军提升[[12%]]攻击力，持续[[8]]秒。
      </p>

      <h3>技能</h3>
      <p>
        向最近的一名敌人发射一枚宝石，命中后产生爆炸，并对半径1格范围内的所有敌人造成[[150%]]伤害，并对范围内的所有友军恢复[[150%]]的生命值。
      </p>
      <p>
        <strong>3级：</strong
        >宝石会根据主目标的伤害类型而变化成不同形态，并对受影响目标产生不同的额外效果：若主目标造成物理伤害则变为红宝石，降低敌人[[10%]]护甲并提升友军[[10%]]护甲，持续[[5]]秒：若主目标造成魔法伤害则变为蓝宝石，降低敌人[[10%]]魔抗并提升友军[[10%]]魔抗，持续[[5]]秒。
      </p>
    </article>
  </StyledText>
</template>
