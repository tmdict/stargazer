<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './GalahadSkill.data'

setupContentMeta({
  title: 'Galahad · Skills',
  description:
    'Galahad casts a protection spell on the weakest ally, granting them a 480% shield that lasts for 8s. When the shield expires, it deals 240% damage to adjacent enemies.',
  url: 'skill/galahad',
  locale: 'en',
  keywords: ['Galahad', '加拉哈德', '加拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Galahad</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Galahad casts a protection spell on the [[weakest]] ally, granting them a [[480%]] shield
        that lasts for [[8]]s. When the shield expires, it deals [[240%]] damage to adjacent
        enemies.
      </p>

      <h2>Targeting Mechanics</h2>

      <h3>EX Skill</h3>
      <p>
        When a battle starts, Galahad marks the nearest allied hero, prioritizing the one behind
        her. When Galahad's magic circle is fully formed for the first time, she summons a shadow
        that recreates the marked ally as they were at the start of battle.
      </p>
      <p>
        The shadow remains on the battlefield for [[12]]s, inheriting [[80%]] of the ally's basic
        stats and starting with [[400]] extra Initial Energy. A shadow is not considered a living
        hero and cannot be targeted by enemies.
      </p>

      <h3>How It Works</h3>
      <p>
        Galahad looks for ally characters on tiles adjacent to her, starting from tiles adjacent to
        her and expanding outwards, prioritizing characters in the back. When multiple characters
        are in the same row, Galahad will prioritize the character to the right (lower hex ID):
      </p>
      <ul>
        <li>
          <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from rearmost row to
          frontmost row, and right to left (lower hex ID).
        </li>
        <li>
          <strong>Ring 2:</strong> 12 tiles at distance 2, starting from rearmost row to frontmost
          row, and right to left (lower hex ID).
        </li>
        <li>And so on...</li>
      </ul>
      <p>When on enemy team, Galahad prioritize teammates with the higher hex ID (180° rotation)</p>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <p>
        Galahad will only target main characters, skipping summons and clones such as Phraesto's
        clone or Elijah & Lailah's Lailah (pink twin).
      </p>
    </article>
  </StyledText>
</template>
