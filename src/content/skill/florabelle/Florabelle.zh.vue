<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('florabelle', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>芙拉贝尔 (老师)</h1>

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        战斗开始时，召唤长矛花灵“淘淘”协助作战。淘淘继承自身[[80%]]最大生命值，普通攻击造成自身[[60%]]伤害。当淘淘被击败时会回到豆荚中休息，并在[10]]秒后自动复活。
      </p>
      <p>
        主动使用时，选择一个格子，在该位置召唤大锤花灵“困困”并重击地面，对周围1格范围内的所有敌人造成[[300%]]伤害和击飞效果。困困继承自身[[220%]]最大生命值，普通攻击造成自身[[120%]]伤害。当困困受到控制效果影响时，其受到的一切伤害提高[[100%]]。
      </p>

      <h3>技能</h3>
      <p>
        在自己身后召唤短弓花灵“乐乐”协助作战。乐乐拥有[[6]]格射程，继承自身[[45%]]最大生命值，普通攻击造成自身[[80%]]伤害。当乐乐已在场上时，本技能效果改为令其进行一次“短弓乱射”，随机发射[[8]]支箭攻击场上敌人，每支箭造成[[70%]]伤害。乐乐被击败后[[8]]秒内无法再次将其召唤。
      </p>
    </article>
  </StyledText>
</template>
