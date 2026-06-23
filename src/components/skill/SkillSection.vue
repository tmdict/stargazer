<script setup lang="ts">
import { computed } from 'vue'

import { highlightSkillText } from '@/utils/textHighlight'

interface LevelRow {
  level: number
  description: string
}

interface RefinementRow {
  tier: number
  description: string
}

const props = defineProps<{
  heading?: string
  slotTags?: { name: string; label: string }[]
  levels: LevelRow[]
  refinements?: RefinementRow[]
  /** Levels to accent as the ones that earn an active tag (guide view). */
  highlightLevels?: number[]
}>()

const rendered = computed(() =>
  props.levels.map((l) => ({
    level: l.level,
    html: highlightSkillText(l.description),
    isUpgrade: l.level > 1,
    isTagged: props.highlightLevels?.includes(l.level) ?? false,
  })),
)

const renderedRefinements = computed(() =>
  (props.refinements ?? []).map((r) => ({
    tier: r.tier,
    html: highlightSkillText(r.description),
  })),
)
</script>

<template>
  <section class="skill-section">
    <header v-if="heading || slotTags?.length" class="skill-section-header">
      <h2 v-if="heading" class="skill-section-heading">{{ heading }}</h2>
      <span v-if="slotTags?.length" class="skill-section-chips">
        <RouterLink
          v-for="tag in slotTags"
          :key="tag.name"
          class="skill-level-chip"
          :to="{ path: '/skills', query: { tag: tag.name } }"
          >{{ tag.label }}</RouterLink
        >
      </span>
    </header>
    <div class="skill-levels">
      <div
        v-for="row in rendered"
        :key="row.level"
        class="skill-level"
        :class="{ upgrade: row.isUpgrade, tagged: row.isTagged }"
      >
        <div v-if="row.isUpgrade" class="skill-level-row">
          <span class="skill-level-badge">LV {{ row.level }}</span>
          <p class="skill-level-desc" v-html="row.html" />
        </div>
        <p v-else class="skill-level-desc" v-html="row.html" />
      </div>
      <div
        v-for="row in renderedRefinements"
        :key="`refine-${row.tier}`"
        class="skill-level upgrade refine"
      >
        <div class="skill-level-row">
          <span class="skill-level-badge refine-badge">REFINE {{ row.tier }}</span>
          <p class="skill-level-desc" v-html="row.html" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.skill-section {
  margin: var(--spacing-lg) 0;
}

/* Border lives on the wrapper (not the h2) so it spans full section width. */
.skill-section-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  margin: 0 0 var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
}

.skill-section-heading {
  margin: 0;
  padding: 0;
  border-bottom: none;
  font-size: 18px;
  font-weight: 600;
}

.skill-section-chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.skill-levels {
  display: flex;
  flex-direction: column;
}

.skill-level {
  padding: 6px 0;
  border-top: 1px dotted rgba(255, 255, 255, 0.12);
}

.skill-level:first-child {
  padding-top: 0;
  border-top: none;
}

/* Accent the level(s) responsible for the active tag in the guide view:
   background tint only, matching the content snippets (no left bar, square). */
.skill-level.tagged {
  padding: 6px var(--spacing-md);
  background: rgba(95, 196, 187, 0.08);
}

/* Badge + description form a sub-row so chips (when present) sit above as a
   normal block and the badge column stays aligned across levels. */
.skill-level-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.skill-level-chip {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  background: rgba(95, 196, 187, 0.18);
  color: #5fc4bb;
  text-decoration: none;
  transition: background-color 0.15s;
}

/* Override content.css's global `.content a:hover` (red + underline) so the
   chip just lifts its background and keeps its teal text. */
.skill-level-chip:hover {
  background: rgba(95, 196, 187, 0.28);
  color: #5fc4bb;
  text-decoration: none;
}

.skill-level-badge {
  flex: 0 0 auto;
  /* Matches body first-line height (15px × 1.55) so the small label is
     vertically centered against the first line of description text. */
  line-height: 23.25px;
  color: rgba(255, 255, 255, 0.55);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* EX refinement tiers (Refine 2 / Refine 4). Distinct teal so they read as a
   different tier class from the numeric LV badges above without competing
   with the per-section chip strip. */
.skill-level-badge.refine-badge {
  color: #5fc4bb;
}

.skill-level-desc {
  margin: 0;
  white-space: pre-line;
  line-height: 1.55;
  flex: 1;
}

.skill-level.upgrade .skill-level-desc {
  font-size: 15px;
}
</style>
