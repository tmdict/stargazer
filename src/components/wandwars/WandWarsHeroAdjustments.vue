<script setup lang="ts">
import { computed, ref } from 'vue'

import FilterIcons from '@/components/ui/FilterIcons.vue'
import heroBuffs from '@/data/wandwars/hero-buffs.json'
import type { ArtifactStatKey } from '@/lib/types/artifact'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { formatName } from '@/wandwars/formatting'

defineProps<{
  characterImages: Record<string, string>
}>()

const i18n = useI18nStore()
const gameDataStore = useGameDataStore()

const factionFilter = ref('')

const factionOptions = computed(() =>
  [...new Set(gameDataStore.characters.map((c) => c.faction))].sort(),
)

const factionByHero = computed(() => {
  const map = new Map<string, string>()
  for (const c of gameDataStore.characters) map.set(c.name, c.faction)
  return map
})

interface BuffRow {
  hero: string
  hp: number
  atk: number
  physDef: number
  magicDef: number
}

// Keys stay kebab-case (they double as the game.<key> i18n key); BuffRow fields are camelCase.
const STAT_FIELDS: Partial<Record<ArtifactStatKey, keyof Omit<BuffRow, 'hero'>>> = {
  hp: 'hp',
  atk: 'atk',
  'phys-def': 'physDef',
  'magic-def': 'magicDef',
}

// The data file holds multiple patches; only the most recent is shown.
const latestBuffs = (heroBuffs.patches[heroBuffs.patches.length - 1]?.buffs ??
  []) as Partial<BuffRow>[]

const allRows = computed<BuffRow[]>(() =>
  latestBuffs.map((b) => ({
    hero: b.hero ?? '',
    hp: b.hp ?? 0,
    atk: b.atk ?? 0,
    physDef: b.physDef ?? 0,
    magicDef: b.magicDef ?? 0,
  })),
)

const rows = computed<BuffRow[]>(() => {
  if (!factionFilter.value) return allRows.value
  return allRows.value.filter((r) => factionByHero.value.get(r.hero) === factionFilter.value)
})

// Scale bars off the full patch (not the filtered view) so lengths stay comparable
// hero-to-hero. The scale is split by direction and the axis sits at maxNeg : maxPos,
// so the buff-dominant data fills the card instead of reserving an always-empty nerf
// half, while keeping the same pixels-per-point on both sides.
const deltas = computed(() => allRows.value.flatMap((r) => [r.hp, r.atk, r.physDef, r.magicDef]))
const maxPos = computed(() => Math.max(1, ...deltas.value.filter((v) => v > 0)))
const maxNeg = computed(() => Math.max(0, ...deltas.value.filter((v) => v < 0).map((v) => -v)))

function visibleStats(row: BuffRow): { key: ArtifactStatKey; value: number }[] {
  return Object.entries(STAT_FIELDS).flatMap(([key, field]) => {
    if (!field) return []
    const value = row[field]
    return value !== 0 ? [{ key: key as ArtifactStatKey, value }] : []
  })
}

function barWidth(value: number): string {
  const max = (value < 0 ? maxNeg.value : maxPos.value) || 1
  return `${(Math.abs(value) / max) * 100}%`
}

function formatStat(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}
</script>

<template>
  <section class="adjustments-panel">
    <div class="filters-row">
      <FilterIcons
        v-model="factionFilter"
        icon-prefix="faction"
        :options="factionOptions"
        :size="32"
        :show-tooltip="false"
        active-border-color="var(--color-primary)"
      />
    </div>
    <div class="card-grid">
      <div v-for="row in rows" :key="row.hero" class="hero-card">
        <div class="hero-head">
          <img
            v-if="characterImages[row.hero]"
            :src="characterImages[row.hero]"
            :alt="row.hero"
            class="hero-portrait"
          />
          <span v-else class="hero-portrait hero-portrait-missing" />
          <span class="hero-name">{{ formatName(row.hero) }}</span>
        </div>
        <!-- Diverging bars: nerfs extend left, buffs extend right from a shared zero
             axis. The fixed-width label column keeps that axis aligned across every row. -->
        <div class="stat-bars">
          <div v-for="stat in visibleStats(row)" :key="stat.key" class="stat-bar-row">
            <span class="stat-label">{{ i18n.t(`game.${stat.key}`) }}</span>
            <div class="bar-track">
              <span class="bar-half bar-half-neg" :style="{ flexGrow: maxNeg }">
                <span
                  v-if="stat.value < 0"
                  class="bar-fill bar-fill-neg"
                  :style="{ width: barWidth(stat.value) }"
                />
              </span>
              <span class="bar-half bar-half-pos" :style="{ flexGrow: maxPos }">
                <span
                  v-if="stat.value > 0"
                  class="bar-fill bar-fill-pos"
                  :style="{ width: barWidth(stat.value) }"
                />
              </span>
            </div>
            <span :class="['stat-value', stat.value > 0 ? 'stat-pos' : 'stat-neg']">
              {{ formatStat(stat.value) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.adjustments-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
}

.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: var(--spacing-sm);
}

.hero-card {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  padding: var(--spacing-sm) var(--spacing-md) var(--spacing-md);
  transition: box-shadow var(--transition-fast);
}

.hero-card:hover {
  box-shadow: var(--shadow-small);
}

.hero-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--color-border-light);
}

.hero-portrait {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 1px solid var(--color-border-primary);
  flex-shrink: 0;
}

.hero-portrait-missing {
  background: var(--color-bg-secondary);
}

.hero-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.stat-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-bar-row {
  display: grid;
  grid-template-columns: 64px 1fr 48px;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.75rem;
}

.stat-label {
  color: var(--color-text-primary);
  font-weight: 600;
  white-space: nowrap;
}

.bar-track {
  display: flex;
  align-items: center;
  height: 8px;
}

.bar-half {
  flex: 0 1 0;
  display: flex;
  height: 100%;
  min-width: 0;
}

/* The no-change axis is the inner edge shared by the two halves. */
.bar-half-neg {
  justify-content: flex-end;
  border-right: 1px solid var(--color-border-primary);
}

.bar-half-pos {
  justify-content: flex-start;
}

.bar-fill {
  display: block;
  height: 100%;
  min-width: 3px;
}

.bar-fill-neg {
  background: var(--color-error);
  border-radius: var(--radius-small) 0 0 var(--radius-small);
}

.bar-fill-pos {
  background: var(--color-success);
  border-radius: 0 var(--radius-small) var(--radius-small) 0;
}

.stat-value {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.stat-pos {
  color: var(--color-success);
}

.stat-neg {
  color: var(--color-error);
}

@media (max-width: 768px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
