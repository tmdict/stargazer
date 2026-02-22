<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('koko', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>卡卡</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>
        鼓舞自已和全体友军使他们获得暂时的[[45%]]伤害减免持续[[12]]秒并记录被减免的伤害值，在持续时间结束后这部分伤害值会一次性以真实伤害结算。在此期间，友军们还会获得[[30]]点生命取和[[10%]]攻击力加成。
      </p>

      <h3>技能</h3>
      <p>投喂[[最虚弱的]]1名友军，使其恢复[[230%]]生命值，并提升[[10%]]攻击力，持续[[5]]秒。</p>
    </article>
  </StyledText>
</template>
