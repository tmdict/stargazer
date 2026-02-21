<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './AlicethSkill.data'

setupSkillContentMeta('aliceth', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Aliceth</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Passive. Aliceth grants an ally Brightfeather, prioritizing the nearest ally in her row.
        After that ally deals ranged damage [[3]] times, they unleash a feather for an additional
        strike, dealing [[120%]] damage. This extra strike can trigger once every [[0.5]]s.
      </p>
      <p>
        If the ally granted Brightfeather is a ranged unit, their normal attack range is increased
        by [[5]] tiles. The ally loses Brightfeather if they are defeated.
      </p>
      <p>
        When a battle starts, Aliceth places her Mark of Judgment on the farthest enemy. She and
        allies with Brightfeather both prioritize attacking the marked enemy, and their attacks
        against that enemy gain an extra [[35]] Penetration.
      </p>

      <strong>How It Works (Ally)</strong>
      <p>
        Aliceth first checks for ally characters in the same row as her. When multiple ally
        characters are in the same row, Aliceth will target the character closer to her, and when
        both are at the same distance, prioritizing the one further to the left (higher hex ID).
      </p>

      <p>
        When no ally character is found in the same row, Aliceth will search for characters on tiles
        adjacent to her tile, expanding outward:
      </p>
      <ul>
        <li>
          <strong>Ring 1:</strong> 6 tiles immediately adjacent, starting from frontmost row to
          rearmost row, and left to right.
        </li>
        <li>
          <strong>Ring 2:</strong> 12 tiles at distance 2, starting from frontmost row to rearmost
          row, and left to right.
        </li>
        <li>And so on...</li>
      </ul>

      <div style="text-align: center">
        <GridSnippet :grid-style="gridStyles.rowScan1" :images layout="inline" />
        <GridSnippet :grid-style="gridStyles.rowScan2" :images layout="inline" />
      </div>

      <p>
        Another way to visualize this: Aliceth scans from the tiles adjacent to her, expanding
        outward from the highest hex ID to the lowest ID, targeting the first ally character found.
      </p>
      <p>
        When Aliceth is on the enemy team, this behavior is flipped, with Aliceth scanning from
        right (lower hex ID) to left (higher hex ID).
      </p>

      <strong>How It Works (Enemy)</strong>
      <p>
        Aliceth automatically identifies and targets an opposing team's character that is furthest
        away from her current tile.
      </p>
      <p>Distance calculation uses hexagonal grid distance to determine the furthest enemy.</p>
      <p>When multiple enemies have the same distance:</p>
      <ul>
        <li><strong>Ally Team Aliceth:</strong> Prefers the enemy with the lower hex ID</li>
        <li>
          <strong>Enemy Team Aliceth:</strong> Prefers the enemy with the higher hex ID (180°
          rotation)
        </li>
      </ul>
    </article>
  </StyledText>
</template>
