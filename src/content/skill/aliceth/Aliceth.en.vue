<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Aliceth.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title="How It Works (Ally)">
        <p>
          Aliceth first checks for teammate characters in the same row as her. When multiple
          teammate characters are in the same row, Aliceth will target the character closer to her,
          and when both are at the same distance, prioritizing the one further to the left (higher
          hex ID).
        </p>
        <p>
          When no teammate character is found in the same row, Aliceth will search for characters on
          tiles adjacent to her tile, expanding outward:
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
          outward from the highest hex ID to the lowest ID, targeting the first teammate character
          found.
        </p>
        <p>
          When Aliceth is on the enemy team, this behavior is flipped, with Aliceth scanning from
          right (lower hex ID) to left (higher hex ID).
        </p>
      </SkillSnippet>
      <SkillSnippet title="How It Works (Enemy)">
        <p>
          Aliceth automatically identifies and targets an opposing-team character that is furthest
          away from her current tile.
        </p>
        <p>Distance calculation uses hexagonal grid distance to determine the furthest opponent.</p>
        <p>When multiple opponents have the same distance:</p>
        <ul>
          <li><strong>Ally Team Aliceth:</strong> Prefers the opponent with the lower hex ID</li>
          <li>
            <strong>Enemy Team Aliceth:</strong> Prefers the opponent with the higher hex ID (180°
            rotation)
          </li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
