<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('zanie', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Zanie</h1>

      <h2>Summon</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> When a battle starts, Zanie builds a gun turret in front of her.
        The turret inherits [[70%]] of her max HP and ATK. Its normal attack has a range of 3 tiles
        and deals damage equal to [[100%]] of the gun turret's ATK, prioritizing the enemy closest
        to any laser turret.
      </p>

      <strong>How It Works</strong>
      <p>The 2 laser turrets Zanie deploys during battle preparation do not count as summons.</p>
    </article>
  </StyledText>
</template>
