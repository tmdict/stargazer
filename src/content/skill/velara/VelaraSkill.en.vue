<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Velara · Skills',
  url: 'skill/velara',
  locale: 'en',
  keywords: ['Velara', '缇洛亚'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Velara</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Passive. When a battle starts, Velara summons [[4]] dormant magic circles on the
        battlefield. Each circle awakens after accumulating [[1000]] Energy. When a circle awakens,
        it affects all units within 2 tiles, restoring [[40%]] HP to allies and reducing enemies'
        Haste by [[30]].
      </p>
      <p>
        Active. Velara channels her Energy into one of her dormant circles until it awakens. If all
        circles are already awakened, she instead expands their area of effect to cover the entire
        battlefield and transfers [[30%]] of [[basic stats]] from all enemies, then evenly
        distributing them among all allied units, lasting for [[10]]s. The transferred stats that
        each ally receives cannot exceed [[45%]] of Velara's starting stats. In boss fights, allies
        will always receive the maximum amount of transferred stats.
      </p>

      <strong>How It Works</strong>
      <p>Tile positional buffs are considered temporary buffs.</p>
    </article>
  </StyledText>
</template>
