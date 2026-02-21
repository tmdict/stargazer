<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lily-may', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Lily May</h1>

      <h2>Ultimate Negation</h2>

      <h3>Ultimate</h3>
      <p>
        <strong>Passive.</strong> Lily May enters a Defensive State at the start of a battle. When a
        non-summoned enemy casts their Ultimate, Lily May becomes [[unaffected]]. She then leaps
        above the enemy and shoots a Quellbolt, dealing [[200%]] damage and interrupting the enemy's
        Ultimate, while causing the enemy to lose [[700]] Energy. Afterward, she exits the Defensive
        and [[unaffected]] States.
      </p>

      <strong>How It Works</strong>
      <p>When battle starts:</p>
      <ul>
        <li>
          If Lily May is defending and there are multiple targets to interrupt, she prioritizes the
          front-most enemy.
        </li>
        <li>
          If Lily May is attacking and there are multiple targets to interrupt, she prioritizes the
          rear-most enemy.
        </li>
        <li>
          If Lily May does not have target to interrupt, she will use Rainstorm Ballet instead.
        </li>
      </ul>
    </article>
  </StyledText>
</template>
