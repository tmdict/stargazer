<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('bryon', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>布莱恩 (鸟人)</h1>

      <h2>开局开大招 · 召唤</h2>

      <h3>终极技能</h3>
      <p>
        被动地，布莱恩拥有1000点初始能量，战斗开始时会使得猎集艾洛娜飞至空中伺机待发。使用终极技能时，立即消耗[[300]]点能量，呼唤艾洛娜对布莱恩当前自标进行俯冲打击，造成[[320%]]伤害，随后使得艾洛娜在场上协同作战，每秒消耗能量，且消耗量会随时间逐渐提升，当能量耗尽或布莱恩被击败时，艾洛娜将会离开战场。
      </p>
    </article>
  </StyledText>
</template>
