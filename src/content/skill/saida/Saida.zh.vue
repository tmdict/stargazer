<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('saida', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>悉达</h1>

      <h2>削能</h2>

      <h3>终极技能</h3>
      <p>
        悉达瞬移到敌人面前，使其无法行动，对其造成共[[520%]]伤害并吸收共[[220]]点能量，期间悉达处于[[霸体]]状态，随后在敌人身上种下“吮噬心核”。本技能优先对未种下“吮噬心核”的敌人使用。当“吮噬心核”的宿主被击败或悉达为已种下“吮噬心核”的敌人再次释放终极技能时，这枚“吮噬心核”会掉落在场上，且场上至多同时存在[[8]]个“吮噬心核”，在挑战首领的模式中，掉落在场上的“吮噬心核”不会阻挡角色。
      </p>
      <p>被动地，每[[2.5]]秒，“吮噬心核”对宿主造成[[250%]]伤害，并扣除敌人[[120]]点能量。</p>
    </article>
  </StyledText>
</template>
