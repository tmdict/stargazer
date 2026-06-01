<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ex>
      <SkillSnippet title-key="mechanic-targeting">
        <p>
          Dunlingr automatically identifies and targets a character on his own team that is furthest
          away from his current tile.
        </p>
        <p>
          Distance calculation uses hexagonal grid distance to determine the furthest teammate.
          Dunlingr cannot target himself.
        </p>
        <p>When multiple teammates have the same distance:</p>
        <ul>
          <li><strong>Ally Team Dunlingr:</strong> Prefers the teammate with the lower hex ID</li>
          <li>
            <strong>Enemy Team Dunlingr:</strong> Prefers the teammate with the higher hex ID (180°
            rotation)
          </li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
