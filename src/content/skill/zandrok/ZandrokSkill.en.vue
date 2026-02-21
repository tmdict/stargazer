<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('zandrok', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Zandrok</h1>

      <h2>Non-Permanent Buff (Instant)</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> When a battle starts, Zandrok summons illusions of himself that
        charge forward in a 5-tile-wide wedge formation toward the enemy side, dealing [[10%]]
        damage and destroying all obstacles in their path. Any allies they pass through, including
        Zandrok, become inspired. Inspired Zandrok and allies gain [[50%]] and [[20%]] extra max HP
        respectively until the battle ends, with their current HP remaining unchanged. They also
        increase their Life Drain by [[40]], Haste by [[20]], and movement speed by [[100%]] for
        [[8]]s.
      </p>
      <p>
        <strong>Active.</strong> Zandrok inspires allies within 2 tiles, increasing their Life Drain
        by [[25]] and Haste by [[14]] for [[8]]s. Unstackable.
      </p>
    </article>
  </StyledText>
</template>
