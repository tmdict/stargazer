<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #ultimate>
      <SkillSnippet title-key="temp-buff">
        <p>
          Ruthless Rite's stat transfer is a temp buff. However, with Enhance Force it lasts until
          the battle ends and is no longer considered a temporary buff.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
