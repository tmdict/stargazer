<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="temp-buff">
        <p>
          The fertile ground's ATK and DEF bonuses are a temporary buff for allies standing on it.
        </p>
      </SkillSnippet>
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
