<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('damian', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Damian</h1>

      <h2>Non-Permanent Buff · Summon</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Passive.</strong> Damian cannot be attacked during the battle. He builds a toy
        chariot that inherits [[85%]] of his HP and [[100%]] of his other stats to take his place
        when a battle starts. He then stays out of the battlefield and will run away after all
        allies are defeated.
      </p>

      <h3>EX Skill</h3>
      <p>
        Damian's toy chariot activates a music halo when it responds to Emergency Support! for the
        first time, inspiring non-summoned allies within [[2]] tiles and increasing their Haste by
        [[40]] for [[10]]s.
      </p>
    </article>
  </StyledText>
</template>
