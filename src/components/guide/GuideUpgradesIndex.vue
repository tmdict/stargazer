<script setup lang="ts">
/* Upgrades entry on the guide index: each ramp band as a track with its
   level pills placed at their stat value, so a band that starts higher or
   climbs in smaller steps reads from the bead spacing. Positions follow the
   energy ramp; the other stat groups differ by a couple of percent. */

import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import UpgradeLevelPill from '@/components/ui/UpgradeLevelPill.vue'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import {
  PARAGON_RAMPS,
  paragonFactions,
  rampValues,
  REFINEMENT_RAMPS,
  type StatRamp,
} from '@/lib/characters/upgradeStats'
import { guidePath } from '@/lib/guide'
import type { AppLocale } from '@/lib/types/i18n'
import { useGameDataStore } from '@/stores/gameData'
import { appLabel } from '@/utils/skillLabels'

const props = defineProps<{ lang: AppLocale }>()

const gameData = useGameDataStore()

const label = (key: string): string => appLabel(key, props.lang)

interface Band {
  key: string
  kind: 'paragon' | 'refinement'
  title: string
  factions: readonly string[]
  /** Each level's share of the band's own max, in percent. */
  beads: number[]
}

const beads = (ramp: StatRamp, attrId: number): number[] => {
  const values = rampValues(ramp, attrId)
  const max = values[values.length - 1] || 1
  return values.map((value) => Math.round((value / max) * 1000) / 10)
}

const bands = computed((): Band[] => [
  {
    key: 'standard',
    kind: 'paragon',
    title: label('paragon'),
    factions: paragonFactions('standard'),
    beads: beads(PARAGON_RAMPS.standard.energy, ATTR_PARAGON),
  },
  {
    key: 'celestialHypogean',
    kind: 'paragon',
    title: label('paragon'),
    factions: paragonFactions('celestialHypogean'),
    beads: beads(PARAGON_RAMPS.celestialHypogean.energy, ATTR_PARAGON),
  },
  {
    key: 'refinement',
    kind: 'refinement',
    title: label('ex-refinement'),
    factions: [],
    beads: beads(REFINEMENT_RAMPS[0]!, ATTR_REFINEMENT),
  },
])
</script>

<template>
  <article class="container guide-panel">
    <div class="content guide-link">
      <RouterLink class="guide-title" :to="guidePath(lang, 'upgrades')">
        <h2>{{ label('upgrades') }}</h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ label('guide-upgrades-blurb') }}</p>
      <div class="bands">
        <div v-for="band in bands" :key="band.key" class="band" :class="band.kind">
          <span class="band-head">
            {{ band.title }}
            <span v-if="band.factions.length" class="factions">
              <img
                v-for="faction in band.factions"
                :key="faction"
                :src="gameData.getIcon(`faction-${faction}`)"
                alt=""
              />
            </span>
          </span>
          <span class="track" :style="{ '--from': `${band.beads[0]}%` }">
            <UpgradeLevelPill
              v-for="(share, level) in band.beads"
              :key="level"
              class="bead"
              :kind="band.kind"
              :level
              :style="{ '--v': `${share}%` }"
            />
          </span>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped>
.bands {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
}

/* A fixed name column keeps every track starting and ending on the same x,
   so bead positions compare across rows. */
.band {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 13px;
}
.band:last-child {
  border-bottom: none;
}

.band-head {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  white-space: nowrap;
}

/* The ring is the panel background, so overlapped icons read as separate discs. */
.factions {
  display: inline-flex;
  margin-left: 6px;
}
.factions img {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--guide-panel-bg);
  box-shadow: 0 0 0 1.5px var(--guide-panel-bg);
}
.factions img + img {
  margin-left: -5px;
}

/* Inset by half a bead so the P0 and max pills sit inside the row. */
.track {
  position: relative;
  height: 22px;
  margin: 0 14px;
}
.track::before,
.track::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  height: 6px;
  transform: translateY(-50%);
  border-radius: 3px;
}
.track::before {
  left: 0;
  background: rgba(255, 255, 255, 0.08);
}
.track::after {
  left: var(--from);
}
.band.paragon .track::after {
  background: color-mix(in srgb, var(--upgrade-pill-paragon-max) 40%, transparent);
}
.band.refinement .track::after {
  background: color-mix(in srgb, var(--upgrade-pill-refinement-max) 40%, transparent);
}

.track .bead {
  position: absolute;
  top: 50%;
  left: var(--v);
  transform: translate(-50%, -50%);
  min-width: 28px;
  padding: 3px 4px 2px;
  font-size: 9.5px;
}

@container (max-width: 420px) {
  .band {
    grid-template-columns: 120px minmax(0, 1fr);
  }
}
</style>
