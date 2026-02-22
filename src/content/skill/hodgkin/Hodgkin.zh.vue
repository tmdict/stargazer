<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hodgkin', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>霍德希金 (船长)</h1>

      <h2>召唤</h2>

      <h3>专武技能</h3>
      <p>
        战斗开始时，霍德希金在身边召唤2个携带“亡灵秘法”的“死潮鲨鱼勾手”，继承自身[[60%]]的生命值和[[100%]]的其他属性，且只会普通攻击。携带“亡灵秘法”的角色阵亡时，会产生一次强烈的爆炸，对1格范围内的敌人造成[[120%]]的伤害，还会附加携带者最大生命值[[10%]]的伤害，附加伤害最高不超过霍德希金[[200%]]，并且还会使命中的敌人损失[[200]]点能量。
      </p>
    </article>
  </StyledText>
</template>
