<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './PandoraSkill.data'

setupContentMeta({
  title: 'Pandora · Skills',
  description:
    'When a battle starts, Pandora pulls the rearmost ally into her box, making them invincible but unable to cast skills. After 4s, the ally is released from the box. If Pandora is still alive when that happens, the ally gains 1000 Energy, as well as 35% ATK for the next 10s.',
  url: 'skill/pandora',
  locale: 'en',
  keywords: ['Pandora', '潘多拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Pandora</h1>

      <h2>Energy Recharge</h2>

      <h3>Skill</h3>
      <p>
        <strong>Passive.</strong> Each time Pandora casts her skills, she restores [[290%]] HP and
        [[90]] Energy to the ally she released from her box.
      </p>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Pandora pulls the [[rearmost ally]] into her box, making them
        [[invincible]] but unable to cast skills. After [[4]]s, the ally is released from the box.
        If Pandora is still alive when that happens, the ally gains [[1000]] Energy, as well as
        [[35%]] ATK for the next [[10]]s.
      </p>

      <h2>Targeting Mechanics</h2>

      <h3>How It Works</h3>
      <p>
        The grid is organized into horizontal rows, with row 15 (hexes 44, 45) being the rearmost
        position for the enemy team, and row 1 (hexes 1, 2) being the rearmost for the ally team.
      </p>
      <p>
        Within the same row, leftmost (higher hex IDs) tiles are considered "further back" on the
        enemy side, while rightmost (lower hex IDs) tiles are "further back" on the ally side.
      </p>
      <p>The rearmost character is determined by their position on the hexagonal grid:</p>
      <ul>
        <li>
          <strong>Ally Team Pandora:</strong> Scans ally positions starting from the rearmost row,
          from right to left (lowest tile ID to highest), targeting the first ally found.
        </li>
        <li>
          <strong>Enemy Team Pandora:</strong> Scans enemy positions in reverse orer, from left to
          right (highest tile ID to lowest), targeting the first enemy found.
        </li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />
    </article>
  </StyledText>
</template>
