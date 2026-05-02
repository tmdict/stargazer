<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('saida', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Saida</h1>

      <h2>Energy Reduction</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Active.</strong> Saida teleports in front of an enemy, preventing them from moving
        or acting. She then deals [[520%]] damage and drains [[220]] Energy from the enemy. Saida
        remains [[unaffected]] while doing this and plants a Drain Seed in the enemy. She
        prioritizes enemies without a Drain Seed.
      </p>
      <p>
        This seed drops to the ground if its host is defeated or if Saida uses her Ultimate on its
        host again. Up to [[8]] Drain Seeds can exist on the battlefield at the same time. In boss
        fights, Drain Seeds on the ground will not obstruct unit movement.
      </p>
      <p>
        <strong>Passive.</strong> Every [[2.5]]s, Drain Seed deals [[250%]] damage to its host and
        reduces their Energy by [[120]].
      </p>
    </article>
  </StyledText>
</template>
