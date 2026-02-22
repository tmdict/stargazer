<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('mikola', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Mikola</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Mikola generates an Honor Arena spanning the battlefield when a battle starts, lasting until
        the battle ends. The side with more units within the arena will gain control of it after
        maintaining the advantage for 3s.
      </p>
      <p>
        Mikola restores all allies' HP by [[12%]] per second and increases their ATK by [[14%]] when
        her side gains control of the Honor Arena.
      </p>

      <strong>How It Works</strong>
      <p>Tile positional buffs are considered temporary buffs.</p>

      <h3>Skill</h3>
      <p>
        Mikola rings her bell, restoring [[130%]] HP and increasing Phys & Magic DEF by [[40%]] for
        herself and the [[2 weakest]] allies for [[5]]s.
      </p>
    </article>
  </StyledText>
</template>
