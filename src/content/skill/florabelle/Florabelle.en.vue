<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('florabelle', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Florabelle</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        Florabelle summons Spiny when a battle starts. Spiny inherits [[80%]] of Florabelle's Max
        HP, dealing [[60%]] damage with normal attacks. Spiny retreats to the pod when defeated,
        then rejoins the battle after [[10]]s.
      </p>
      <p>
        <strong>Active.</strong> Florabelle selects a tile to summon Smashy to smash the ground,
        dealing [[300%]] damage to all adjacent enemies and knocking them into the air. Smashy
        inherits [[220%]] of Florabelle's Max HP, dealing [[120%]] damage with normal attacks.
        Smashy takes [[100%]] extra damage when under control effects.
      </p>

      <h3>Skill</h3>
      <p>
        Florabelle summons Swifty in the back. Swifty has a [[6]]-tile attack range, inherits
        [[45%]] of Florabelle's Max HP, and deals [[80%]] damage with normal attacks. Casting this
        skill while Swifty is already on the battlefield initiates Swifty's Rapid Fire, unleashing
        [[8]] arrows at random targets, each dealing [[70%]] damage. Swifty cannot be summoned again
        for the next [[8]]s after being defeated.
      </p>
    </article>
  </StyledText>
</template>
