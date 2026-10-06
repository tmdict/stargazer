<script setup lang="ts">
import { computed } from 'vue'

import SkillSectionHeader, { type SlotChip } from './SkillSectionHeader.vue'
import IconArrowRight from '@/components/ui/IconArrowRight.vue'
import type { SkillLocaleFile, SlotNumbers } from '@/lib/types/skill'
import { skillMetaItems } from '@/utils/skillLabels'
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
  // Cooldown and range, shown under the heading; labels are the skill-text
  // file's `_terms`.
  numbers?: SlotNumbers
  terms?: SkillLocaleFile['_terms']
  // The hero's own starting energy, shown with the numbers of its ultimate.
  initialEnergy?: number
  slotTags?: SlotChip[]
  levels: LevelRow[]
  refinements?: RefinementRow[]
  highlightLevels?: number[]
}>()

const meta = computed(() => skillMetaItems(props.numbers, props.terms, props.initialEnergy))

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
    <SkillSectionHeader :heading :slot-tags />
    <!-- The build leaves this line out of the page description by its
         `skill-meta` class (extractContentDescription in vite.config.ts). -->
    <p v-if="meta.length" class="skill-meta reading-meta">
      <span v-for="item in meta" :key="item.before"
        >{{ item.before
        }}<span class="skill-meta-value"
          ><template v-for="(value, i) in item.values" :key="i"
            ><template v-if="i > 0"
              ><IconArrowRight class="skill-meta-arrow" aria-hidden="true" /><span
                class="visually-hidden"
                >→</span
              ></template
            >{{ value }}</template
          ></span
        >{{ item.after }}</span
      >
    </p>
    <div class="skill-levels">
      <div
        v-for="row in rendered"
        :key="row.level"
        class="skill-level"
        :class="{ upgrade: row.isUpgrade, tagged: row.isTagged }"
      >
        <div v-if="row.isUpgrade" class="skill-level-row">
          <span class="skill-level-badge">LV {{ row.level }}</span>
          <p class="skill-level-desc reading-secondary" v-html="row.html" />
        </div>
        <p v-else class="skill-level-desc" v-html="row.html" />
      </div>
      <div
        v-for="row in renderedRefinements"
        :key="`refine-${row.tier}`"
        class="skill-level upgrade refine"
      >
        <div class="skill-level-row">
          <span class="skill-level-badge refine-badge">R{{ row.tier }}</span>
          <p class="skill-level-desc reading-secondary" v-html="row.html" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.skill-section {
  margin: var(--spacing-lg) 0;
  /* Hash-targeted sections (search deep links) land clear of the header. */
  scroll-margin-top: 80px;
}

.skill-meta {
  display: flex;
  flex-wrap: wrap;
  column-gap: 18px;
  margin: 0 0 var(--spacing-sm);
}

.skill-meta-value {
  color: rgba(255, 255, 255, 0.92);
}

/* `middle` sets the icon's center on the lowercase letters' middle; digits
   stand taller, so a 1px lift centers it on them. */
.skill-meta-arrow {
  margin: 0 5px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

/* The arrow as text, for screen readers and copied text. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
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

/* The tint bleeds into the container's gutter so the text keeps the other rows' column. */
.skill-level.tagged {
  margin: 0 calc(-1 * var(--spacing-md));
  padding: 6px var(--spacing-md);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.skill-level-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
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

/* EX refinement tiers (R2 / R4). Distinct teal so they read as a different
   tier class from the numeric LV badges above without competing with the
   per-section chip strip. */
.skill-level-badge.refine-badge {
  color: var(--color-accent);
}

.skill-level-desc {
  margin: 0;
  white-space: pre-line;
  flex: 1;
}
</style>
