<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('lorsan', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Lorsan</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Lorsan protects the weakest ally with Zephyr's Embrace for [[6]]s. While active, the
        protected ally gains [[50 dodge chance]], [[30]] Haste, and recovers [[90%]] HP per second.
      </p>
    </article>
  </StyledText>
</template>
