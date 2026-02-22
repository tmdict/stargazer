<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hewynn', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>伊温 (荷叶)</h1>

      <h2>非永久增益</h2>

      <h3>终极技能</h3>
      <p>持续施法[[9]]秒，每秒为所有友方单位回复[[95%]]的生命值。</p>

      <h3>专武技能</h3>
      <p>
        <strong>3级：</strong
        >释放“祈雨”时，伊温每次治疗都会附带“焕然”的技能效果。“祈雨”期间，所有友军受到的伤害下降[[34%]]。
      </p>

      <h3>觉醒之力</h3>
      <p>技能“焕然”生效时，还会使自标友车在[[6]]秒内提升[[30]]点急速。</p>
    </article>
  </StyledText>
</template>
