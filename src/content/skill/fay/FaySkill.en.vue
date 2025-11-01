<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Fay · Skills',
  description:
    'Fay selects a direction and casts vitality magic to frontal allies within a 3-tile arc, restoring 300% HP and increasing their ATK by 12% for 8s.',
  url: 'skill/fay',
  locale: 'en',
  keywords: ['Fay', '菲'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Fay</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Fay selects a direction and casts vitality magic to frontal allies within a 3-tile arc,
        restoring [[300%]] HP and increasing their ATK by [[12%]] for [[8]]s.
      </p>

      <h3>Skill</h3>
      <p>
        Fay smacks a gem at an enemy. She causes an explosion when the skill hits, dealing [[150%]]
        damage to adjacent enemies and restoring [[150%]] HP to all allies within range.
      </p>
      <p>
        <strong>Level 3:</strong> The gem has 2 forms and 2 different buffs. It becomes a ruby if
        the target deals physical damage, reducing enemies' Phys DEF by [[10%]] and increasing
        allies' Phys DEF by [[10%]] for [[5]]s. It becomes a Sapphire if the target deals magic
        damage, reducing enemies' Magic DEF by [[10%]] and increasing allies' Magic DEF by [[10%]]
        for [[5]]s.
      </p>
    </article>
  </StyledText>
</template>
