<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Lily May · Skills',
  description:
    "Lily May enters a Defensive State at the start of a battle. When a non-summoned enemy casts their Ultimate, Lily May becomes unaffected. She then leaps above the enemy and shoots a Quellbolt, dealing 200% damage and interrupting the enemy's Ultimate, while causing the enemy to lose 700 Energy. Afterward, she exits the Defensive and unaffected States.",
  url: 'skill/lily-may',
  locale: 'en',
  keywords: ['Lily May', '五月'],
})
</script>

<template>
  <article>
    <h1>Lily May</h1>

    <h2>Ultimate Negation</h2>

    <h3>Ultimate</h3>
    <p>
      <strong>Passive.</strong> Lily May enters a Defensive State at the start of a battle. When a
      non-summoned enemy casts their Ultimate, Lily May becomes unaffected. She then leaps above the
      enemy and shoots a Quellbolt, dealing 200% damage and interrupting the enemy's Ultimate, while
      causing the enemy to lose 700 Energy. Afterward, she exits the Defensive and unaffected
      States.
    </p>

    <h3>How It Works</h3>

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
      <li>If Lily May does not have target to interrupt, she will use Rainstorm Ballet instead.</li>
    </ul>
  </article>
</template>
