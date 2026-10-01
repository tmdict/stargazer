<script setup lang="ts">
/* One upgrade level (P2, R4) in the portrait pill's look. */

import { computed } from 'vue'

import UpgradeLevelLabel from '@/components/ui/UpgradeLevelLabel.vue'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { pillFill } from '@/lib/characters/upgradeStats'

const { kind, level } = defineProps<{ kind: 'paragon' | 'refinement'; level: number }>()

const attrId = computed(() => (kind === 'paragon' ? ATTR_PARAGON : ATTR_REFINEMENT))
</script>

<template>
  <span
    class="lvl"
    :class="{ max: level >= attrMax(attrId) }"
    :style="{ background: pillFill(attrId, level) }"
  >
    <UpgradeLevelLabel :kind :level />
  </span>
</template>

<style scoped>
.lvl {
  display: inline-block;
  min-width: 28px;
  padding: 2.5px 5px;
  border-radius: 999px;
  color: var(--upgrade-pill-gray-text);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
  box-shadow:
    var(--upgrade-pill-rim),
    0 1px 3px rgba(0, 0, 0, 0.35);
}
.lvl.max {
  color: #fff;
}
</style>
