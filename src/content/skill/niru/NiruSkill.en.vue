<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Niru · Skills',
  description:
    'Niru prioritizes the weakest ally and casts a spell to protect them from a fatal blow turning them into a Spirit and restoring their HP to 45% of max HP. The Spirit can only deal 45% of its original damage while losing an increasing amount of HP every second. Once its HP runs out, the Spirit will be defeated.',
  url: 'skill/niru',
  locale: 'en',
  keywords: ['Niru', '尼汝'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Niru</h1>

      <h2>Instant Ultimate</h2>

      <h3>Ultimate</h3>
      <p>
        Niru prioritizes the [[weakest]] ally and casts a spell to protect them from a [[fatal
        blow]] turning them into a Spirit and restoring their HP to [[45%]] of max HP. The Spirit
        can only deal [[45%]] of its original damage while losing an increasing amount of HP every
        second. Once its HP runs out, the Spirit will be defeated.
      </p>

      <h3>EX Skill</h3>
      <p>
        Niru casts Ultimate on the nearest ally without consuming Energy when a battle starts,
        prioritizing the ally behind himself.
      </p>
    </article>
  </StyledText>
</template>
