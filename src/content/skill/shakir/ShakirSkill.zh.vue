<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('shakir', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>沙奎尔 (狼人)</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        处于“狼形态”时，沙奎尔生成2格范围的“狂狼光环”，并且普通攻击会对面前1格扇形区域内的所有敌军造成伤害。处于“狂狼光环”内的友军受到的伤害降低[[20%]]，提升[[10]]点急速。
      </p>

      <h3>专武技能</h3>
      <p><strong>3级：</strong>“狂狼光环”中每个非召唤物友军享受“狼王战意”中相同的攻击力加成。</p>
    </article>
  </StyledText>
</template>
