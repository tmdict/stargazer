<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="guide-tile">
        <p>When battle starts:</p>
        <ul>
          <li>
            If Lily May is defending and there are multiple targets to interrupt, she prioritizes
            the front-most opponent.
          </li>
          <li>
            If Lily May is attacking and there are multiple targets to interrupt, she prioritizes
            the rear-most opponent.
          </li>
          <li>
            If Lily May does not have target to interrupt, she will use Rainstorm Ballet instead.
          </li>
        </ul>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
