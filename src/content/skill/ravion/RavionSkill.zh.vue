<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '沙利叶 · 技能',
  description:
    '战斗开始时，为最靠后的2名友军发放任务牌，当其累计对敌人造成沙利叶初始攻击力2000%的伤害或参与击败敌人后，任务完成。完成任务的角色立刻恢复150能量并使自身获得沙利叶初始攻击力的12%，持续30秒。',
  url: 'skill/ravion',
  locale: 'zh',
  keywords: ['Ravion', '沙利叶'],
})
</script>

<template>
  <article>
    <h1>沙利叶</h1>

    <h2>非永久增益</h2>

    <h3>技能</h3>
    <p>
      战斗开始时，为最靠后的2名友军发放任务牌，当其累计对敌人造成沙利叶初始攻击力2000%的伤害或参与击败敌人后，任务完成。完成任务的角色立刻恢复150能量并使自身获得沙利叶初始攻击力的12%，持续30秒。
    </p>

    <h3>觉醒之力</h3>
    <p>队友在接受任务牌时获得15%攻击力提升和霸体，持续5秒。</p>
  </article>
</template>
