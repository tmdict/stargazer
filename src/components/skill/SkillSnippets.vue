<script setup lang="ts">
import { computed, inject, useSlots } from 'vue'

import { SLOT_ORDER, type SlotKey } from '@/lib/types/skill'
import { SkillSnippetAnchorsKey } from './snippetKeys'

// Root of a per-hero snippet file. Each named template slot is teleported
// into the matching skill section's anchor (provided by <SkillSections>).

const slots = useSlots()
const anchors = inject(SkillSnippetAnchorsKey, null)

const present = computed(() =>
  Object.keys(slots).filter((k): k is SlotKey => (SLOT_ORDER as readonly string[]).includes(k)),
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
</template>
