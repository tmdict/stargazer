<script setup lang="ts">
import { computed, ref } from 'vue'

import FilterIcons from '@/components/ui/FilterIcons.vue'
import heroBuffs from '@/data/wandwars/hero-buffs.json'
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

type StatKey = 'hp' | 'atk' | 'phys-def' | 'magic-def'

const STAT_ORDER: { key: StatKey; field: keyof Omit<BuffRow, 'hero'> }[] = [
  { key: 'hp', field: 'hp' },
  { key: 'atk', field: 'atk' },
  { key: 'phys-def', field: 'physDef' },
  { key: 'magic-def', field: 'magicDef' },
]

const allRows = computed<BuffRow[]>(() =>
  (heroBuffs as Partial<BuffRow>[]).map((b) => ({
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

function visibleStats(row: BuffRow): { key: StatKey; value: number }[] {
  return STAT_ORDER.map(({ key, field }) => ({ key, value: row[field] })).filter(
    (s) => s.value !== 0,
  )
}

function formatStat(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value}%`
}
</script>

<template>
  <div class="adjustments-panel">
    <section class="section">
      <h3 class="section-title">{{ i18n.t('wandwars.hero-adjustments') }}</h3>
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
          <ul class="stat-list">
            <li
              v-for="stat in visibleStats(row)"
              :key="stat.key"
              :class="['stat-row', `stat-${stat.key}`]"
            >
              <span class="stat-label">{{ i18n.t(`wandwars.${stat.key}`) }}</span>
              <span :class="['stat-value', stat.value > 0 ? 'stat-pos' : 'stat-neg']">
                {{ formatStat(stat.value) }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.adjustments-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  border-radius: var(--radius-medium);
}

.section-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  letter-spacing: 0.05em;
}

.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--spacing-sm);
}

.hero-card {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-left: 3px solid var(--color-primary);
  border-radius: var(--radius-small);
  overflow: hidden;
  transition: box-shadow var(--transition-fast);
}

.hero-card:hover {
  box-shadow: var(--shadow-small);
}

.hero-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex: 0 0 150px;
  min-width: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-white);
  border-right: 1px solid var(--color-border-light);
}

.hero-portrait {
  width: 52px;
  height: 52px;
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
  font-size: 0.8rem;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
  line-height: 1.2;
}

.stat-list {
  list-style: none;
  margin: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  display: grid;
  grid-template-columns: auto auto;
  grid-template-rows: auto auto;
  gap: 2px var(--spacing-md);
  justify-content: start;
  align-content: center;
  background: var(--color-bg-white);
  flex: 1;
}

.stat-row {
  display: flex;
  align-items: baseline;
  gap: var(--spacing-xs);
  font-size: 0.8rem;
  min-width: 0;
}

.stat-hp {
  grid-row: 1;
  grid-column: 1;
}

.stat-atk {
  grid-row: 2;
  grid-column: 1;
}

.stat-phys-def {
  grid-row: 1;
  grid-column: 2;
}

.stat-magic-def {
  grid-row: 2;
  grid-column: 2;
}

.stat-label {
  color: var(--color-text-secondary);
}

.stat-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.stat-pos {
  color: var(--color-success);
}

.stat-neg {
  color: var(--color-error);
}
</style>
