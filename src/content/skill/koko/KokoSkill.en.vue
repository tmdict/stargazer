<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Koko · Skills',
  description:
    'Koko inspires herself and all allies, granting them a 45% DMG Reduction for 12s and recording the amount of damage reduced. After the duration of Full Energy ends, the recorded damage will be dealt as true damage to all allies. When the skill takes effect, allies gain 30 Life Drain and 10% ATK.',
  url: 'skill/koko',
  locale: 'en',
  keywords: ['Koko', '卡卡'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Koko</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        Koko inspires herself and all allies, granting them a [[45%]] DMG Reduction for [[12]]s and
        recording the amount of damage reduced. After the duration of Full Energy ends, the recorded
        damage will be dealt as true damage to all allies. When the skill takes effect, allies gain
        [[30]] Life Drain and [[10%]] ATK.
      </p>

      <h3>Skill</h3>
      <p>
        Koko feeds the [[weakest]] ally, healing them by [[230%]] HP and granting them [[10%]] ATK
        for [[5]]s.
      </p>
    </article>
  </StyledText>
</template>
