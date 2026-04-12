<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hepler', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Hepler</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        While in True Form, Hepler casts a healing spell on the [[weakest]] ally, healing them for
        [[130%]] HP per second for [[6]]s.
      </p>
      <p>
        While in Altered Form, Hepler casts a healing spell on the [[3]] [[weakest]] allies and
        grants them toughened skin, healing them for [[130%]] HP per second for [[6]]s and granting
        them a [[400%]] shield for [[15]]s.
      </p>
    </article>
  </StyledText>
</template>
