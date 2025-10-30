<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: '五月 · 技能',
  description:
    '被动地，战斗开始时进入“警戒”状态。当非召唤物敌军释放终极技能时，五月立即进入霸体状态，飞跃至其头顶向其发射一支禁魔箭，造成200%伤害并打断其终极技能，使其失去700点能量，随后结束“警戒”和霸体状态。',
  url: 'skill/lily-may',
  locale: 'zh',
  keywords: ['Lily May', '五月'],
})
</script>

<template>
  <article>
    <h1>五月</h1>

    <h2>大招打断</h2>

    <h3>被动</h3>
    <p>
      被动地，战斗开始时进入“警戒”状态。当非召唤物敌军释放终极技能时，五月立即进入霸体状态，飞跃至其头顶向其发射一支禁魔箭，造成200%伤害并打断其终极技能，使其失去700点能量，随后结束“警戒”和霸体状态。
    </p>

    <h3>技能机制</h3>

    <p>战斗开始时：</p>

    <ul>
      <li>如果五月处于防守一方且有多个目标可以打断，她会优先选择最前方的敌人。</li>
      <li>如果五月处于进攻一方且有多个目标可以打断，她会优先选择最后方的敌人。</li>
      <li>如果五月没有可以打断的目标，她将改为使用“疾雨之舞”。</li>
    </ul>
  </article>
</template>
