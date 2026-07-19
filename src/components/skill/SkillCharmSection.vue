<script setup lang="ts">
import { computed } from 'vue'

import { highlightSkillText } from '@/utils/textHighlight'

const props = defineProps<{
  heading: string
  sharedLabel: string
  /** Localized tier labels, Elite → Mythic order. */
  tierNames: string[]
  /** Tier descriptions, same order as tierNames. */
  texts: string[]
  /** Display names of the other heroes sharing this charm. */
  sharedNames: string[]
}>()

// Badge tints index by tier position, not by label text, so they hold in
// every content language.
const TIER_CLASSES = ['tier-elite', 'tier-epic', 'tier-legendary', 'tier-mythic'] as const

const rows = computed(() =>
  props.texts.map((text, i) => ({
    name: props.tierNames[i] ?? '',
    tierClass: TIER_CLASSES[i] ?? '',
    html: highlightSkillText(text),
  })),
)

const sharedLine = computed(() =>
  props.sharedNames.length > 0 ? props.sharedNames.join(', ') : null,
)
</script>

<template>
  <!-- id anchors the search overlay's deep links (#charm). -->
  <section id="charm" class="charm-section">
    <header class="charm-header">
      <h2 class="charm-heading">{{ heading }}</h2>
    </header>
    <div class="charm-tiers">
      <div v-for="(row, i) in rows" :key="i" class="charm-tier">
        <span class="charm-tier-badge" :class="row.tierClass">{{ row.name }}</span>
        <p class="charm-tier-desc" v-html="row.html" />
      </div>
    </div>
    <p v-if="sharedLine" class="charm-shared">{{ sharedLabel }}: {{ sharedLine }}</p>
  </section>
</template>

<style scoped>
.charm-section {
  margin: var(--spacing-lg) 0;
  scroll-margin-top: 80px;
}

.charm-header {
  margin: 0 0 var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
}

/* Border lives on the wrapper so it spans full section width; content.css's
   global h2 underline is cancelled here, same as SkillSection. */
.charm-heading {
  margin: 0;
  padding: 0;
  border-bottom: none;
  font-size: 18px;
  font-weight: 600;
}

.charm-tier {
  padding: 6px 0;
  border-top: 1px dotted rgba(255, 255, 255, 0.12);
}

.charm-tier:first-child {
  padding-top: 0;
  border-top: none;
}

/* On its own line so the description keeps the full section width. */
.charm-tier-badge {
  display: block;
  margin-bottom: 2px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tier-elite {
  color: var(--color-tier-1);
}

.tier-epic {
  color: var(--color-tier-2);
}

.tier-legendary {
  color: var(--color-tier-3);
}

.tier-mythic {
  color: var(--color-tier-4);
}

.charm-tier-desc {
  margin: 0;
  white-space: pre-line;
  line-height: 1.55;
  font-size: 15px;
}

.charm-shared {
  margin: var(--spacing-sm) 0 0;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.45);
}
</style>
