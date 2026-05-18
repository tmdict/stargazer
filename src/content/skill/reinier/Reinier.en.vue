<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
import { gridStyles, images } from './Reinier.data'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="how-it-works">
        <p>
          Reinier identifies symmetrical hex pairs where one contains an ally and the other contains
          an enemy.
        </p>
        <p>
          When multiple ally-enemy pairs are present, use the following rules to handle tie-break:
        </p>
        <ul>
          <li>
            <strong>Ally Team (targeting enemy):</strong> Neighbor tile priority: Bottom-left → Left
            → Bottom-right → Right → Top-left → Top-right
          </li>
          <li>
            <strong>Enemy Team (targeting ally):</strong> Neighbor tile priority: Top-right →
            Top-left → Right → Bottom-right → Left → Bottom-left (180° rotation)
          </li>
        </ul>
        <GridSnippet :grid-style="gridStyles.main" :images />
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
