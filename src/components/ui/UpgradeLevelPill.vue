<script setup lang="ts">
/* A single upgrade level in the portrait pill's look: gray below max,
   paragon silver-blue at max, refinement warming from R2 to red at max.
   The guide's level headers and the index's ramp beads wear it. */

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { pillTone } from '@/lib/characters/upgradeStats'

const { kind, level } = defineProps<{ kind: 'paragon' | 'refinement'; level: number }>()

const attrId = kind === 'paragon' ? ATTR_PARAGON : ATTR_REFINEMENT
const tone = pillTone(attrId, level)
const text = `${kind === 'paragon' ? 'P' : 'R'}${level}`
</script>

<template>
  <span class="lvl" :class="[kind, tone]">{{ text }}</span>
</template>

<style scoped>
.lvl {
  display: inline-block;
  min-width: 30px;
  padding: 4px 6px 3px;
  border: 1.5px solid #fff;
  border-radius: 999px;
  background: var(--upgrade-pill-gray);
  color: var(--upgrade-pill-gray-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  line-height: 1;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}
.lvl.paragon.max {
  background: var(--upgrade-pill-paragon-max);
  color: #fff;
}
.lvl.refinement.mid {
  background: var(--upgrade-pill-refinement-mid);
}
.lvl.refinement.max {
  background: var(--upgrade-pill-refinement-max);
  color: #fff;
}
</style>
