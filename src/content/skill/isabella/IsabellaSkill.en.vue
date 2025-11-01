<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Isabella · Skills',
  description:
    "When Isabella casts her Ultimate, she increases her companion's ATK by 15% and their Haste by 15 for 6s.",
  url: 'skill/isabella',
  locale: 'en',
  keywords: ['Isabella', '伊莎贝拉'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Isabella</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Ultimate</h3>
      <p>
        When Isabella casts her Ultimate, she increases her companion's ATK by [[15%]] and their
        Haste by [[15]] for [[6]]s.
      </p>
      <p>Additionally, each spell note stack buffs the companion's corresponding stat:</p>
      <ul>
        <li>ATK, Phys DEF, and Magic DEF: +[[15%]] per stack.</li>
        <li>ATK SPD, Haste, and Vitality: +[[15]] per stack.</li>
      </ul>

      <h2>Targeting Mechanics</h2>

      <h3>Ultimate</h3>
      <p>
        When a battle starts, Isabella selects the [[frontmost]] allied hero as her companion. If
        the companion is defeated, Isabella will select a new one. Whenever the companion receives a
        stat boost to ATK, ATK SPD, Haste, Phys DEF, Magic DEF, or Vitality, Isabella gains a
        permanent stack of spell note corresponding to that stat. Each type of spell note can stack
        up to 3 times. Note that stat boosts granted by Isabella's spell notes themselves do not
        trigger additional stacks of spell notes.
      </p>
    </article>
  </StyledText>
</template>
