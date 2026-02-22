<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lucy', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>露西</h1>

      <h2>召唤</h2>

      <h3>终极技能</h3>
      <p>
        在自己身边召唤“水瓶座的阿葵亚”帮助战斗。阿葵亚拥有露西[[120%]]的最大生命值，其余属性与露西相同。阿葵亚登场时立即使用魔法制造水龙卷，对以敌人最密集处为中心的半径1格范围内的所有敌人造成[[300%]]的伤害，并使受影响的敌人被击飞并眩晕持续[[2]]秒，后续每[[10]]秒使用一次。阿葵亚的普通攻击造成[[100%]]伤害，且攻击距离为[[10]]。
      </p>
    </article>
  </StyledText>
</template>
