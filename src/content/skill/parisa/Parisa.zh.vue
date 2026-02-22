<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('parisa', 'zh')
</script>

<template>
  <StyledText>
    <article>
      <h1>帕瑞莎 (花女)</h1>

      <h2>非永久增益</h2>

      <h3>技能</h3>
      <p>
        为自己与最近的[[1]]名友军提升[[22]]点攻击速度，并使自己和该名友军的普通攻击伤害提高[[22%]]，持续[[10]]秒。
      </p>
    </article>
  </StyledText>
</template>
