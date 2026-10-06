<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="guide-tile" body-key="tile-positional-buff" />
    </template>
    <template #ex>
      <SkillSnippet title-key="temp-buff" body-key="temp-buff-definition">
        <p>
          To trigger the effect at Divine Grace Lv. 3, buffs from two different allies must be
          active at the same time.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
