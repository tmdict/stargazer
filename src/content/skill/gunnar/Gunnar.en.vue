<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('gunnar', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Gunnar</h1>

      <h2>Non-Permanent Buff (Instant)</h2>

      <h3>Ultimate</h3>
      <p>
        When a battle starts, if there is an ally placed 1 tile behind Gunnar, he summons a
        Doomfield at that ally's location, increasing their normal attack range by [[3]] and ATK by
        [25%] of Gunnar's initial ATK. He and the ally remain [[steadfast]] until Gunnar is
        defeated, or until [[3]]s after the ally leaves the Doomfield. During battle, Gunnar locks
        onto and prioritizes attacking the enemy targeted by the ally standing on his Doomfield.
      </p>

      <h3>Skill</h3>
      <p>
        Gunnar lets out a roar, granting himself a shield that absorbs [[450%]] damage. He also
        grants a shield that absorbs [[400%]] damage for [[6]]s to every ally [[behind]] him. If
        there is a Doomfield active, the Doomfield gets strengthened, increasing the ATK SPD of the
        ally within it by [[40]] for [[8]]s.
      </p>

      <strong>How It Works</strong>
      <p>Tile positional buffs are considered temporary buffs.</p>
    </article>
  </StyledText>
</template>
