<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('laios', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Laios</h1>

      <h2>Summon</h2>

      <h3>Ultimate</h3>
      <p>
        Laios summons a slow-moving armor with infinite HP, controlled by Kensuke. This Living Armor
        starts with 1,000 Energy and deals damage equal to [[300%]] of Laios' ATK. It loses [[25]]
        Energy per second while it exists. Whenever it takes base damage exceeding [[250%]] of the
        caster's ATK, it loses an extra [[100]] Energy. At zero Energy, the armor crumbles on the
        spot but regains [[125]] Energy per second until its Energy is full again, and then it
        returns to combat. When casting this skill again, Laios recovers 1,000 Energy for Kensuke,
        grants it control immunity and increases its ATK SPD by [[120]] over the next [[10]]s.
      </p>
    </article>
  </StyledText>
</template>
