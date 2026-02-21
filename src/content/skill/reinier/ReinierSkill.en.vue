<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './ReinierSkill.data'

setupContentMeta({
  title: 'Reinier · Skills',
  description:
    "When a battle starts, Reinier switches an adjacent ally's position with an enemy if they're in symmetrical positions. Whenever the enemy takes damage, the ally restores HP equal to 45% of the enemy's taken damage till a battle ends.",
  url: 'skill/reinier',
  locale: 'en',
  keywords: ['Reinier', '雷内亚', '四手'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Reinier</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Reinier switches an adjacent ally's position with an enemy if they're
        in [[symmetrical]] positions. Whenever the enemy takes damage, the ally restores HP equal to
        [[45%]] of the enemy's taken damage till a battle ends.
      </p>

      <strong>How It Works</strong>
      <p>
        Reinier identifies symmetrical hex pairs where one contains an ally and the other contains
        an enemy.
      </p>
      <p>
        When multiple ally-enemy pairs are present, use the following rules to handle tie-break:
      </p>
      <ul>
        <li>
          <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left → Left →
          Bottom-right → Right → Top-left → Top-right
        </li>
        <li>
          <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right → Top-left
          → Right → Bottom-right → Left → Bottom-left (180° rotation)
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <h3>Hero Focus</h3>
      <p>
        Reinier's Dynamic Balance increases the target's ATK by [[7%]] when cast on an ally or
        reduces the target ATK by [[7%]] when cast on an enemy.
      </p>

      <h3>EX Skill</h3>
      <p>
        Reinier deals [[200%]] damage to the enemy and knocks them down when casting Dynamic
        Balance, increasing their damage taken by [[25%]] till the battle ends.
      </p>
      <p>
        <strong>Level 3:</strong> Reduces the position-switched ally's damage taken by [[25%]] till
        the battle ends.
      </p>
    </article>
  </StyledText>
</template>
