<script setup lang="ts">
import { setupContentMeta } from '@/utils/contentMeta'

setupContentMeta({
  title: 'Ravion · Skills',
  description:
    "When a battle starts, Ravion assigns an Objective to each of the 2 rearmost allies. Allies complete their objective by either dealing damage equal to 2000% of Ravion's initial ATK or assisting or defeating an enemy. Upon completion, the ally recovers 150 Energy and increases their ATK by 12% of Ravion's initial ATK for 30s.",
  url: 'skill/ravion',
  locale: 'en',
  keywords: ['Ravion', '沙利叶'],
})
</script>

<template>
  <article>
    <h1>Ravion</h1>

    <h2>Non-Permanent Buff</h2>

    <h3>Skill</h3>
    <p>
      When a battle starts, Ravion assigns an Objective to each of the 2 rearmost allies. Allies
      complete their objective by either dealing damage equal to 2000% of Ravion's initial ATK or
      assisting or defeating an enemy. Upon completion, the ally recovers 150 Energy and increases
      their ATK by 12% of Ravion's initial ATK for 30s.
    </p>

    <h3>Enhance Force</h3>
    <p>
      When an ally accepts the Objective from Ravion, they increase their ATK by 15% and become
      unaffected. These effects last for 5s.
    </p>
  </article>
</template>
