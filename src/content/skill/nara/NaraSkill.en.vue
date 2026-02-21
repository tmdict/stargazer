<script setup lang="ts">
import GridSnippet from '@/components/grid/GridSnippet.vue'
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'
import { gridStyles, images } from './NaraSkill.data'

setupContentMeta({
  title: 'Nara · Skills',
  description:
    "Nara pulls a distant enemy hero toward her when there are no enemy heroes within her normal attack range. The target loses 3.5% HP for every tile they are pulled, up to 250% of Nara's ATK. This skill won't defeat the enemy and prioritizes attacking the closest enemy in a symmetrical position.",
  url: 'skill/nara',
  locale: 'en',
  keywords: ['Nara', '奈拉', '钩子'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Nara</h1>

      <h2>Targeting Mechanics</h2>

      <h3>Skill</h3>
      <p>
        Nara pulls a distant enemy hero toward her when there are no enemy heroes within her normal
        attack range. The target loses [[3.5%]] HP for every tile they are pulled, up to [[250%]] of
        Nara's ATK. This skill won't defeat the enemy and prioritizes attacking the closest enemy in
        a [[symmetrical]] position.
      </p>

      <strong>How It Works</strong>
      <p>
        Nara first checks her symmetrical tile (the mirror position across the grid's center). If an
        enemy is there, they become the target.
      </p>
      <p>
        If the symmetrical tile is empty, Nara searches for the nearest enemy in a clockwise spiral
        expanding from that tile's position:
      </p>
      <ul>
        <li><strong>Ring 1:</strong> 6 tiles immediately adjacent</li>
        <li><strong>Ring 2:</strong> 12 tiles at distance 2</li>
        <li>And so on...</li>
      </ul>

      <GridSnippet :grid-style="gridStyles.main" :images />

      <p>
        Ally (targeting enemy) walks clockwise from top-right, while Enemy (targeting ally) walks
        counter-clockwise from bottom-left (180° rotation).
      </p>
    </article>
  </StyledText>
</template>
