<script setup lang="ts">
/* The Seasonal tab's charms in small: the season's first charms as the tab
   lists them, and the first one's heroes and tier texts as its popup shows
   them. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import HelpMock from '@/components/help/HelpMock.vue'
import HelpScene from '@/components/help/HelpScene.vue'
import { useHelpLocale } from '@/composables/useHelpLocale'
import { loadCharms } from '@/lib/dataLoader'
import { oldestFirst } from '@/lib/heroAge'
import { appLabel } from '@/utils/skillLabels'

const lang = useHelpLocale()

const CHARMS = 3
const FACES = 6

const charms = loadCharms()
  .slice(0, CHARMS)
  .map(({ id, heroes }) => ({ id, heroes: oldestFirst(heroes) }))
const picked = charms[0]

// Widths of the lines that stand for a charm's four tier texts, in percent.
const TIER_LINES = [92, 74, 86, 58]
</script>

<template>
  <HelpScene>
    <template #from>
      <HelpMock :caption="appLabel('seasonal', lang)">
        <div
          v-for="charm in charms"
          :key="charm.id"
          class="charm"
          :class="{ picked: charm === picked }"
        >
          <span class="count">{{ charm.heroes.length }}</span>
          <span class="faces">
            <GuidePortrait
              v-for="slug in charm.heroes.slice(-FACES)"
              :key="slug"
              :slug
              :lang
              :size="26"
            />
          </span>
        </div>
      </HelpMock>
    </template>
    <template #to>
      <HelpMock :caption="appLabel('charms', lang)">
        <div class="heroes">
          <GuidePortrait v-for="slug in picked?.heroes" :key="slug" :slug :lang :size="30" />
        </div>
        <div class="tiers">
          <i v-for="(width, i) in TIER_LINES" :key="i" :style="{ width: `${width}%` }"></i>
        </div>
      </HelpMock>
    </template>
  </HelpScene>
</template>

<style scoped>
.charm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px;
  border: 1px solid var(--color-border-primary);
  border-radius: 999px;
}

.charm + .charm {
  margin-top: 7px;
}

.charm.picked {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary);
}

.count {
  min-width: 1.4em;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-primary);
  text-align: right;
}

.faces {
  display: flex;
}

.faces > * + * {
  margin-left: -6px;
}

.heroes {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tiers {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

.tiers i {
  height: 5px;
  border-radius: 3px;
  background: var(--color-text-secondary);
  opacity: 0.35;
}
</style>
