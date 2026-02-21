<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lily-may', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>五月</h1>

      <h2>大招打断</h2>

      <h3>终极技能</h3>
      <p>
        被动地，战斗开始时进入“警戒”状态。当非召唤物敌军释放终极技能时，五月立即进入[[霸体]]状态，飞跃至其头顶向其发射一支禁魔箭，造成[[200%]]伤害并打断其终极技能，使其失去[[700]]点能量，随后结束“警戒”和[[霸体]]状态。
      </p>

      <strong>技能机制</strong>
      <p>战斗开始时：</p>
      <ul>
        <li>如果五月处于防守一方且有多个目标可以打断，她会优先选择最前方的敌人。</li>
        <li>如果五月处于进攻一方且有多个目标可以打断，她会优先选择最后方的敌人。</li>
        <li>如果五月没有可以打断的目标，她将改为使用“疾雨之舞”。</li>
      </ul>
    </article>
  </StyledText>
</template>
