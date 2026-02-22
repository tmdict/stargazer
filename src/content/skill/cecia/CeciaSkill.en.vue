<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('cecia', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Cecia</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        Cecia summons Mr. Carlyle to a selected tile to assist. Mr. Carlyle inherits all of Cecia's
        stats and his normal attack deals [[170%]] damage to enemies within a 1-tile arc. He gains
        an extra [[45%]] max HP but loses [[4%]] of max HP per second. When Mr. Carlyle is summoned,
        he initiates Tangled Agony to entangle enemies within 2 tiles, dealing [[140%]] damage per
        second for [[2]]s. The entangled enemies cannot move or act. If Mr. Carlyle is already on
        the battlefield when this skill is used again, the skill restores his HP to Max, allowing
        him to cast the Tangled Agony again.
      </p>
    </article>
  </StyledText>
</template>
