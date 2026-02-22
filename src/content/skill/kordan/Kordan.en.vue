<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('kordan', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Kordan</h1>

      <h2>Instant Ultimate · Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        When casting this skill, Kordan raises his blade and challenges [[1]] enemy within [[1]]
        tile, immobilizing the target for [[5]]s. At the same time, he summons a hunting circle
        around him and his target, dealing [[180%]] damage to all enemies within the circle and
        knocking back other ranged enemies out of the circle.
      </p>
      <p>
        The hunting circle stays active for [[16]]s. All units within the hunting circle take
        [[60%]] less damage and healing from any outside source. Meanwhile, allied units within the
        circle gain [[20%]] ATK, [[40]] Life Drain, and deal [[20%]] more damage. Kordan can keep
        only one circle active at a time. This skill starts with 1,000 Energy.
      </p>

      <strong>How It Works</strong>
      <p>Tile positional buffs are considered temporary buffs.</p>
    </article>
  </StyledText>
</template>
