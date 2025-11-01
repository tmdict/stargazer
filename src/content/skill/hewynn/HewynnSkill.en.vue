<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Hewynn · Skills',
  description: 'Hewynn also grants the healed ally 30 Haste for 6s when Revitalize is in effect.',
  url: 'skill/hewynn',
  locale: 'en',
  keywords: ['Hewynn', '伊温', '荷叶'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Hewynn</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Enhance Force</h3>
      <p>
        Hewynn also grants the healed ally [[30]] Haste for [[6]]s when Revitalize is in effect.
      </p>
    </article>
  </StyledText>
</template>
