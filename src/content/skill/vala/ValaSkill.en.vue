<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Vala · Skills',
  description:
    'Vala sends a notice to mark the farthest enemy when a battle starts. She prioritizes attacking the noticed enemy, absorbing 90 Energy for each hit.',
  url: 'skill/vala',
  locale: 'en',
  keywords: ['Vala', '维拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Vala</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Vala sends a notice to mark the farthest enemy when a battle starts. She prioritizes
        attacking the noticed enemy, absorbing [[90]] Energy for each hit.
      </p>

      <h3>How It Works</h3>

      <p>
        Vala automatically identifies and targets an opposing team's character that is furthest away
        from her current tile.
      </p>
      <p>Distance calculation uses hexagonal grid distance to determine the furthest enemy.</p>
      <p>When multiple enemies have the same distance:</p>
      <ul>
        <li><strong>Ally Team Vala:</strong> Prefers the enemy with the lower hex ID</li>
        <li>
          <strong>Enemy Team Vala:</strong> Prefers the enemy with the higher hex ID (180° rotation)
        </li>
      </ul>
    </article>
  </StyledText>
</template>
