<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('berial', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>贝利尔 (小丑)</h1>

      <h2>召唤</h2>

      <h3>专武技能</h3>
      <p>
        若场上有非召唤物的敌人持续处于[[孤立]]超过[[3]]秒，则该敌人会失去[[180]]点能量并在身边出现一个目标的残影，残影继承贝利尔[[50%]]的攻击力、生命值和100%的其他属性，且每秒损失[[8%]]最大生命值，持续期间残影只会使用普通攻击对该目标造成伤害。同一个角色[[20]]秒内最多触发一次该效果。
      </p>
    </article>
  </StyledText>
</template>
