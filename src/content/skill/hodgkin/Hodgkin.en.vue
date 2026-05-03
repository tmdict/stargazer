<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('hodgkin', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Hodgkin</h1>

      <h2>Summon · Energy Reduction</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> Hodgkin deals [[240%]] damage to enemies within a 2-tile arc and
        steals [[70]] Energy from them.
      </p>

      <h3>EX Skill</h3>
      <p>
        Hodgkin summons 2 Dead Tide Warriors affected by voidbound magic around him when a battle
        begins, each inheriting [[60%]] of his HP and [[100%]] of his other stats, and can only
        launch normal attacks. When a unit affected by voidbound magic is defeated, they trigger an
        explosion that deals damage equal to [[120%]] plus an extra [[10%]] of the defeated unit's
        max HP to the adjacent enemies. This extra damage cannot exceed [[200%]] of Hodgkin's ATK.
        The targeted enemies also lose [[200]] Energy.
      </p>

      <h2>Initial Energy > 300</h2>

      <h3>Enhance Force</h3>
      <p>
        <strong>Level 2:</strong> Hodgkin gains [[400]] initial Energy. During Cannon Fire, for each
        enemy hit by the cannon at least [[2]] times, he recovers [[150]] Energy and reduces that
        enemy's Vitality by [[80]] for [[10]]s.
      </p>
    </article>
  </StyledText>
</template>
