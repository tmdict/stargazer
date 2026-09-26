<script setup lang="ts">
import { computed } from 'vue'

import SkillSectionHeader from './SkillSectionHeader.vue'
import { highlightSkillText } from '@/utils/textHighlight'

const props = defineProps<{
  heading: string
  slotTags?: { name: string; label: string }[]
  /** Localized tier labels, Elite → Mythic order. */
  tierNames: string[]
  /** The tiers to show (1-4), which a tag filter can narrow. */
  tiers: { tier: number; text: string }[]
  /** Tiers to accent as the ones that earn an active tag (guide view). */
  highlightTiers?: number[]
  sharedLabel?: string
  /** Display names of the other heroes sharing this charm. */
  sharedNames?: string[]
}>()

// Badge tints index by tier, not by label text, so they hold in every content
// language.
const TIER_CLASSES = ['tier-elite', 'tier-epic', 'tier-legendary', 'tier-mythic'] as const

const rows = computed(() =>
  props.tiers.map(({ tier, text }) => ({
    tier,
    name: props.tierNames[tier - 1] ?? '',
    tierClass: TIER_CLASSES[tier - 1] ?? '',
    html: highlightSkillText(text),
    isTagged: props.highlightTiers?.includes(tier) ?? false,
  })),
)

const sharedLine = computed(() =>
  props.sharedLabel && props.sharedNames?.length
    ? `${props.sharedLabel}: ${props.sharedNames.join(', ')}`
    : null,
)
</script>

<template>
  <section class="charm-section">
    <SkillSectionHeader :heading :slot-tags />
    <div class="charm-tiers">
      <div v-for="row in rows" :key="row.tier" class="charm-tier" :class="{ tagged: row.isTagged }">
        <span class="charm-tier-badge" :class="row.tierClass">{{ row.name }}</span>
        <p class="charm-tier-desc" v-html="row.html" />
      </div>
    </div>
    <p v-if="sharedLine" class="charm-shared">{{ sharedLine }}</p>
  </section>
</template>

<style scoped>
.charm-section {
  margin: var(--spacing-lg) 0;
  scroll-margin-top: 80px;
}

.charm-tier {
  padding: 6px 0;
  border-top: 1px dotted rgba(255, 255, 255, 0.12);
}

.charm-tier:first-child {
  padding-top: 0;
  border-top: none;
}

/* Same accent as a tagged skill level in the guide view. */
.charm-tier.tagged {
  padding: 6px var(--spacing-md);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
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
