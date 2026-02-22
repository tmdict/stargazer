<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('phraesto', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Phraesto</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Passive.</strong> Phraesto sacrifices [[12%]] of his max HP, summoning an identical
        Illusion during the preparation stage. This Illusion inherits [[100%]] of Phraesto's stats
        and can cast all his skills. When both Phraesto and his Illusion are positioned in the same
        row, they each receive a [[30%]] damage reduction effect, lasting until one of them is
        defeated.
      </p>

      <h3>EX Skill</h3>
      <p>
        <strong>Level 4:</strong> Phraesto summons a new Illusion in front of himself if the
        previous Illusion is defeated before he is. The new Illusion inherits only [[60%]] of
        Phraesto's max HP. Triggers once at most per battle.
      </p>

      <strong>How It Works</strong>
      <p>
        Phraesto's first clone placed during battle preparation is not a summon, but his second
        clone created when the first dies is a summon.
      </p>
    </article>
  </StyledText>
</template>
