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
        <p>要触发“神光庇佑”3级的效果，来自两名不同友军的增益必须同时存在。</p>
      </SkillSnippet>
    </template>
  </SkillSnippets>
</template>
