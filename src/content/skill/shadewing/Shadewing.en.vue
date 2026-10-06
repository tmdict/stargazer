<script setup lang="ts">
import SkillSnippet from '@/components/skill/SkillSnippet.vue'
import SkillSnippets from '@/components/skill/SkillSnippets.vue'
</script>

<template>
  <SkillSnippets>
    <template #skill3>
      <SkillSnippet title-key="dot">
        <p>
          Continuous damage is the damage or HP loss dealt by a lasting debuff such as poison, burn
          or bleed. Repeated hits do not count as continuous damage just because they happen every
          second.
        </p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
