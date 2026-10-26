<script setup lang="ts">
import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import type { CellState, ReviewPart } from '@/lib/import/review'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { appLabel } from '@/utils/skillLabels'

import '@/styles/import.css'

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)
const i18n = useI18nStore()
const gameData = useGameDataStore()

const MAPS = 3

const FORMATION = [
  { slug: 'frieren', at: [2, 1] as const },
  { slug: 'thoran', at: [2, 3] as const },
]

const SECTIONS = [
  { key: 'import-results', optional: false, maps: [1, 2, 3], board: false },
  { key: 'import-formations', optional: true, maps: [1, 2], board: true },
  { key: 'import-replay', optional: true, maps: [3], board: true },
]

type Cell = { slug: string; paragon: number; refinement: number; state: CellState }

const SIDES: { key: string; cells: Cell[] }[] = [
  {
    key: 'ally',
    cells: [
      { slug: 'frieren', paragon: 4, refinement: 4, state: 'sure' },
      { slug: 'koko', paragon: 4, refinement: 2, state: 'review' },
      { slug: 'valen', paragon: 3, refinement: 0, state: 'sure' },
    ],
  },
  {
    key: 'enemy',
    cells: [
      { slug: 'thoran', paragon: 4, refinement: 4, state: 'sure' },
      { slug: 'odie', paragon: 2, refinement: 1, state: 'sure' },
      { slug: 'vala', paragon: 4, refinement: 3, state: 'sure' },
    ],
  },
]

const characterId = (slug: string): number | null =>
  gameData.characters.find((c) => c.name === slug)?.id ?? null

const doubtful = (state: CellState): ReviewPart[] => (state === 'review' ? ['hero'] : [])
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="label('import-title')" glass>
        <div v-for="section in SECTIONS" :key="section.key" class="help-import-sec">
          <span class="help-import-title">
            {{ label(section.key) }}
            <span v-if="section.optional" class="help-import-optional">{{
              label('import-optional')
            }}</span>
          </span>
          <div class="help-import-shots">
            <span v-for="map in section.maps" :key="map" class="help-import-shot">
              <span v-if="section.board" class="help-import-thumb board">
                <HelpBoard :tokens="FORMATION" />
              </span>
              <span v-else class="help-import-thumb result">
                <span class="help-import-tabs"><span /><span /></span>
                <span v-for="row in 3" :key="row" class="help-import-line" />
              </span>
              <span class="help-import-seg">
                <span v-for="n in MAPS" :key="n" :class="{ on: n === map }">{{ n }}</span>
              </span>
            </span>
          </div>
        </div>
      </HelpMock>
    </template>

    <template #to>
      <HelpMock :caption="label('import-review')" glass>
        <template v-for="side in SIDES" :key="side.key">
          <div class="help-import-side">{{ label(side.key) }}</div>
          <div class="help-import-cells">
            <ImportHeroCell
              v-for="cell in side.cells"
              :key="cell.slug"
              :card="gameData.getCharacterImage(cell.slug)"
              :character-id="characterId(cell.slug)"
              :paragon="cell.paragon"
              :refinement="cell.refinement"
              :state="cell.state"
              :doubtful="doubtful(cell.state)"
              :edited="false"
              :open="false"
            />
          </div>
        </template>
        <div class="import help-import-footer">
          <div class="footer">
            <span class="footer-btn danger">
              {{ i18n.t('app.import-save-as-new', { count: MAPS }) }}
            </span>
          </div>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.help-import-sec + .help-import-sec {
  margin-top: 12px;
}

.help-import-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 0.9rem;
  font-weight: 700;
}

.help-import-optional,
.help-import-side {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.help-import-shots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.help-import-shot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  background: var(--import-surface);
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
}

.help-import-thumb {
  display: flex;
  flex-direction: column;
  height: 52px;
  overflow: hidden;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
}

.help-import-thumb.board {
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.help-import-thumb.board :deep(svg) {
  height: 100%;
  width: auto;
}

.help-import-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  height: 10px;
  margin-bottom: 6px;
}

.help-import-tabs > :first-child {
  background: var(--import-ally);
}

.help-import-tabs > :last-child {
  background: var(--import-enemy);
}

.help-import-line {
  height: 5px;
  margin: 0 8px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.18);
}

.help-import-seg {
  display: flex;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 600;
  text-align: center;
  color: var(--import-text-dim);
}

.help-import-seg > span {
  flex: 1;
  padding: 1px 0;
}

.help-import-seg > span + span {
  border-left: 1px solid var(--import-border);
}

.help-import-seg > .on {
  background: var(--color-accent-active);
  color: #fff;
}

.help-import-side {
  margin-bottom: 6px;
}

.help-import-cells + .help-import-side {
  margin-top: 12px;
}

.help-import-cells {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.help-import-footer {
  margin-top: 14px;
}
</style>
