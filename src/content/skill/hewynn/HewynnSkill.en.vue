<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hewynn', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Hewynn</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>Hewynn heals all allies for [[95%]] HP per second for [[9]]s.</p>

      <h3>EX Skill</h3>
      <p>
        <strong>Level 3:</strong> While Rain Prayer is effective, all allies take less [[34%]]
        damage and receive buffs from Revitalize.
      </p>

      <h3>Enhance Force</h3>
      <p>
        Hewynn also grants the healed ally [[30]] Haste for [[6]]s when Revitalize is in effect.
      </p>
    </article>
  </StyledText>
</template>
