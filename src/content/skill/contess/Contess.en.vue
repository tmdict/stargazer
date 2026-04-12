<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupSkillContentMeta } from '@/utils/contentMeta'

setupSkillContentMeta('contess', 'en')
</script>

<template>
  <StyledText>
    <article>
      <h1>Contess</h1>

      <h2>Ultimate Negation</h2>

      <h3>Skill</h3>
      <p>Code of Conduct - Be Quiet</p>
      <p>
        Whenever a unit casts their Ultimate, that unit is deemed in violation of this rule. A unit
        may only violate this rule once every [[6]]s.
      </p>
      <p>
        <strong>Active.</strong> Contess reduces Energy recovery efficiency by [[14%]] for the 2
        enemies who have cast the most Ultimates. This effect lasts [[6]]s.
      </p>

      <h3>EX Skill</h3>
      <p>
        Contess permanently expels a unit when they're punished more than [[6]] times. Expelled
        units are permanently silenced, even if they are unaffected (ineffective against Bosses),
        and take [[18%]] more HP loss. Allies granted Exemption by Contess are not affected by this
        effect.
      </p>

      <h3>Enhance Force</h3>
      <p>
        In regular battles, Contess stuns enemies who violate Code of Conduct - Be Civil for [[2]]s,
        and silences enemies who violate Code of Conduct - Be Quiet for [[6]]s.
      </p>
      <p>In Boss battles, Contess punishes enemies who violate a school rule one extra time.</p>
    </article>
  </StyledText>
</template>
