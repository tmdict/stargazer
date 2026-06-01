<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill2>
      <SkillSnippet title-key="guide-targeting">
        <p>
          Vala automatically identifies and targets an opposing-team character that is furthest away
          from her current tile.
        </p>
        <p>Distance calculation uses hexagonal grid distance to determine the furthest opponent.</p>
        <p>When multiple opponents have the same distance:</p>
        <ul>
          <li><strong>Ally Team Vala:</strong> Prefers the opponent with the lower hex ID</li>
          <li>
            <strong>Enemy Team Vala:</strong> Prefers the opponent with the higher hex ID (180°
            rotation)
          </li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
