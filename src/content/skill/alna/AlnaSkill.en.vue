<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Alna · Skills',
  description:
    "During battle preparation, Alna selects an ally placed in the same row as herself to become the Winter Warrior. That ally is immune to Winter Anthem's Haste reduction effect, and their max HP is permanently increased by 15%.",
  url: 'skill/alna',
  locale: 'en',
  keywords: ['Alna', '阿尔娜', '冬喉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Alna</h1>

      <h2>Instant Buff</h2>

      <h3>Skill</h3>
      <p>
        During battle preparation, Alna selects an ally placed in the same row as herself to become
        the Winter Warrior. That ally is immune to Winter Anthem's Haste reduction effect, and their
        max HP is permanently increased by [[15]]%.
      </p>

      <h3>EX Skill</h3>
      <p>
        When a battle starts and every [[20]]s thereafter, Alna envelops herself in icy winds,
        becoming immune to damage and control effects for [[4]]s.
      </p>
      <p>
        <strong>Level 3:</strong> After casting Chilling Presence, Alna also grants the Winter
        Warrior the same immunity effects. The first time either Alna's or the Winter Warrior's HP
        drops below [[50%]] in battle, Chilling Presence triggers automatically for both. This
        effect can only be triggered [[1]] times per hero per battle.
      </p>
    </article>
  </StyledText>
</template>
