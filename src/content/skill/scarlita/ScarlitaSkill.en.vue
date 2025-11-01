<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Scarlita · Skills',
  description:
    "Scarlita sends the weakest non-summoned ally a blessing while in the air, granting them a shield equal to 15% of Scarlita's max HP for 3s.",
  url: 'skill/scarlita',
  locale: 'en',
  keywords: ['Scarlita', '斯克嘉丽德', '神斧'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Scarlita</h1>

      <h2>Non-Permanent Buff</h2>

      <h3>Skill</h3>
      <p>
        Scarlita sends [[the weakest]] non-summoned ally a blessing while in the air, granting them
        a shield equal to [[15%]] of Scarlita's max HP for [[3]]s.
      </p>

      <h3>Enhance Force</h3>
      <p>
        <strong>Level 2:</strong> If an ally's HP ratio drops below [[20%]] while Scarlita is in the
        air during Sanctified Verdict, she instantly grants them a shield that blocks [[120%]]
        damage for [[10]]s. This effect can trigger once per battle.
      </p>
    </article>
  </StyledText>
</template>
