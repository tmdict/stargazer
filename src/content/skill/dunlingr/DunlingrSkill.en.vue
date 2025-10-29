<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Dunlingr · Skills',
  description:
    "Dunlingr designates the Bell of Order as either Spellbind or Curelock before a battle starts, setting the stage for the battle's order.",
  url: 'skill/dunlingr',
  locale: 'en',
  keywords: ['Dunlingr', '顿里尔', '钟神'],
})
</script>

<template>
  <article>
    <h1>Dunlingr</h1>

    <h2>Ultimate Negation</h2>

    <h3>Ultimate</h3>
    <p>
      Dunlingr designates the Bell of Order as either Spellbind or Curelock before a battle starts,
      setting the stage for the battle's order.
    </p>
    <ul>
      <li>Spellbind: Unable to cast Ultimate.</li>
      <li>Curelock: Unable to recover HP for others.</li>
    </ul>

    <p>
      <strong>Passive.</strong> Dunlingr summons the Bell of Order when a battle starts and keeps it
      on the battlefield for 12s.
    </p>

    <h2>Targeting Mechanics</h2>

    <h3>EX Skill</h3>
    <p>
      Dunlingr protects the farthest non-summoned ally, ensuring they are not affected by his order
      until the ally is defeated.
    </p>

    <h3>How It Works</h3>

    <p>
      Dunlingr automatically identifies and targets a character on his own team that is furthest
      away from his current tile.
    </p>
    <p>
      Distance calculation uses hexagonal grid distance to determine the furthest teammate. Dunlingr
      cannot target himself.
    </p>
    <p>When multiple teammates have the same distance:</p>
    <ul>
      <li><strong>Ally Team Dunlingr:</strong> Prefers the ally with the lower hex ID</li>
      <li>
        <strong>Enemy Team Dunlingr:</strong> Prefers the teammate with the higher hex ID (180°
        rotation)
      </li>
    </ul>
  </article>
</template>
