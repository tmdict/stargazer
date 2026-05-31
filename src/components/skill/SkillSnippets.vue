<script setup lang="ts">
import { computed, inject, useSlots } from 'vue'

import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
import { SkillSnippetAnchorsKey } from './snippetKeys'

// Root of a per-hero snippet file. With skill-section anchors injected (the
// hero skill page) each named slot teleports into its matching section. Without
// anchors (the mechanics compendium) the slots render inline, in skill order.

const slots = useSlots()
const anchors = inject(SkillSnippetAnchorsKey, null)

const present = computed(() =>
  Object.keys(slots).filter((k): k is SlotKey => (SLOT_ORDER as readonly string[]).includes(k)),
)

const ordered = computed(() =>
  [...present.value].sort((a, b) => SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b)),
)
</script>

<template>
  <template v-if="anchors">
    <template v-for="key in present" :key="key">
      <!-- Skip when the anchor is missing (section filtered out / not in kit). -->
      <Teleport v-if="anchors[key].value" :to="anchors[key].value">
        <slot :name="key" />
      </Teleport>
    </template>
  </template>
  <template v-else>
    <slot v-for="key in ordered" :key="key" :name="key" />
  </template>
</template>
