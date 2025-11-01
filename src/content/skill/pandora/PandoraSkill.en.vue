<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Pandora · Skills',
  description:
    'When a battle starts, Pandora pulls the rearmost ally into her box, making them invincible but unable to cast skills. After 4s, the ally is released from the box. If Pandora is still alive when that happens, the ally gains 1000 Energy, as well as 35% ATK for the next 10s.',
  url: 'skill/pandora',
  locale: 'en',
  keywords: ['Pandora', '潘多拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Pandora</h1>

      <h2>Energy Recharge · Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        When a battle starts, Pandora pulls the [[rearmost ally]] into her box, making them
        [[invincible]] but unable to cast skills. After [[4]]s, the ally is released from the box.
        If Pandora is still alive when that happens, the ally gains [[1000]] Energy, as well as
        [[35%]] ATK for the next [[10]]s.
      </p>
      <p>
        <strong>Passive.</strong> Each time Pandora casts her skills, she restores [[290%]] HP and
        [[90]] Energy to the ally she released from her box.
      </p>
    </article>
  </StyledText>
</template>
