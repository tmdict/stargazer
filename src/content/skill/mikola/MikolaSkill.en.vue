<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Mikola · Skills',
  description:
    'Mikola rings her bell, restoring 130% HP and increasing Phys & Magic DEF by 40% for herself and the 2 weakest allies for 5s.',
  url: 'skill/mikola',
  locale: 'en',
  keywords: ['Mikola', '曼卡拉', '猴女'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Mikola</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Mikola rings her bell, restoring [[130%]] HP and increasing Phys & Magic DEF by [[40%]] for
        herself and the [[2 weakest]] allies for [[5]]s.
      </p>
    </article>
  </StyledText>
</template>
