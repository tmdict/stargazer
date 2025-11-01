<script setup lang="ts">
import StyledText from '@/components/StyledText.vue'
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Elijah & Lailah · Skills',
  description:
    'Elijah forms a Stellar Bond with Lailah when they align on the battlefield. Allied heroes placed in a straight path between the twins are also linked by Stellar Bond.',
  url: 'skill/elijah-lailah',
  locale: 'en',
  keywords: ['Elijah & Lailah', '伊莱亚和莱拉', '双子'],
})
</script>

<template>
  <StyledText>
    <article>
      <h1>Elijah & Lailah</h1>

      <h2>Energy Recharge</h2>

      <h3>Skill</h3>
      <p>
        Elijah forms a Stellar Bond with Lailah when they align on the battlefield. Allied heroes
        placed in a [[straight path]] between the twins are also linked by Stellar Bond.
      </p>
      <p>
        <strong>Active.</strong> Elijah sends a golden glow through the Stellar Bond link to Lailah,
        restoring [[30]] Energy to each linked ally along the path.
      </p>

      <h3>EX Skill</h3>
      <p>
        When a battle starts, if the allies (excluding Elijah and Lailah) linked through Stellar
        Bond all belong to the same faction, a special resonance effect is triggered. The resonance
        increases linked allies' Vitality by an extra [[10]] and their Energy gained by [[10%]].
        After all linked allies have cast their Ultimates while resonance is active, the bond
        unleashes a permanent energy burst, inspiring all allies and returning them [[10%]] of their
        Energy cost each time they cast their Ultimate.
      </p>
    </article>
  </StyledText>
</template>
