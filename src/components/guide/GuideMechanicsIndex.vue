<script setup lang="ts">
/* Mechanics entry on the guide index: one tile per mechanic, deep-linking to
   its card on the mechanics page. */

import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { guidePath } from '@/lib/guide'
import {
  ENERGY_DEFAULT,
  ENERGY_KEY,
  matchesMechanic,
  toMechanicQuery,
  type MechanicPick,
} from '@/lib/mechanics'
import { tagPick } from '@/lib/tags'
import type { AppLocale } from '@/lib/types/i18n'
import { interpolate } from '@/utils/interpolate'
import { appLabel, mechanicPickLabel } from '@/utils/skillLabels'
import { loadMechanicGroups, loadTagVocabulary } from '@/utils/tagData'

const props = defineProps<{ lang: AppLocale }>()

// Portraits per tile; the card itself lists every hero.
const PREVIEW = 4

const label = (key: string): string => appLabel(key, props.lang)
const page = computed(() => guidePath(props.lang, 'mechanics'))

// The query picks the mechanic on the page; the hash scrolls to its card. A
// tile shows the heroes its pick leaves lit there, which for a tag is the
// whole card and for energy the heroes above the starting value.
const vocabulary = loadTagVocabulary()
const tiles = loadMechanicGroups().map((group) => {
  const pick: MechanicPick =
    group.key === ENERGY_KEY ? { energyAbove: ENERGY_DEFAULT } : tagPick(group.key, vocabulary)
  const heroes = group.characters.filter((hero) => matchesMechanic(hero, pick))
  return {
    key: group.key,
    pick,
    link: { query: toMechanicQuery(pick), hash: `#${group.key}` },
    heroes: heroes.slice(0, PREVIEW).map((c) => c.name),
    count: heroes.length,
  }
})
</script>

<template>
  <article class="container page-panel guide-panel">
    <div class="content guide-link">
      <RouterLink class="guide-title" :to="page">
        <h2>{{ label('mechanics') }}</h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ label('guide-mechanics-blurb') }}</p>
      <div class="tiles">
        <RouterLink
          v-for="tile in tiles"
          :key="tile.key"
          class="tile"
          :to="{ path: page, ...tile.link }"
        >
          <span class="tile-name">{{ mechanicPickLabel(tile.pick, lang) }}</span>
          <span class="stack">
            <GuidePortrait v-for="slug in tile.heroes" :key="slug" :slug :lang />
          </span>
          <span class="tile-count">{{ interpolate(label('hero-count'), { n: tile.count }) }}</span>
        </RouterLink>
      </div>
    </div>
  </article>
</template>

<style scoped>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

/* Name on top, portrait stack and count beneath, so long names never wrap
   into uneven rows. */
.tile {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'name name'
    'stack count';
  align-items: center;
  gap: 8px 10px;
  padding: 10px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  text-decoration: none;
  transition: border-color 0.15s;
}
.tile:hover {
  border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
  color: #fff;
  text-decoration: none;
}

.tile-name {
  grid-area: name;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stack {
  grid-area: stack;
  display: inline-flex;
  padding-left: 2px;
}
.stack .disc + .disc {
  margin-left: -9px;
}

.tile-count {
  grid-area: count;
  justify-self: end;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.5);
}

/* Two fixed columns when the panel is narrow (a side column or a phone). */
@container (max-width: 560px) {
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .tile {
    padding: 8px 10px;
  }
  .tile-name {
    font-size: 12.5px;
  }
}
</style>
