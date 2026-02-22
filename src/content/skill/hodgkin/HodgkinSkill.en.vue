<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hodgkin', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Hodgkin</h1>

      <h2>Summon</h2>

      <h3>EX Skill</h3>
      <p>
        Hodgkin summons 2 Dead Tide Warriors affected by voidbound magic around him when a battle
        begins, each inheriting [[60%]] of his HP and [[100%]] of his other stats, and can only
        launch normal attacks. When a unit affected by voidbound magic is defeated, they trigger an
        explosion that deals damage equal to [[120%]] plus an extra [[10%]] of the defeated unit's
        max HP to the adjacent enemies. This extra damage cannot exceed [[200%]] of Hodgkin's ATK.
      </p>
    </article>
  </StyledText>
</template>
