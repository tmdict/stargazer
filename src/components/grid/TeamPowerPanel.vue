<script setup lang="ts">
import { computed } from 'vue'

import type { GridContext } from '@/composables/useGridContext'
import { getTilesWithCharactersByTeam, isBaseHeroId } from '@/lib/characters/character'
import { PARAGON_MAX_LEVEL, teamPowerNet } from '@/lib/characters/paragon'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{ context: GridContext }>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

// Composite paragon ramp: off-grey, then yellow, soft green, teal, deep teal.
const PARAGON_COLORS = [
  { bg: '#cfc8bb', fg: '#4a463d' },
  { bg: '#ead09a', fg: '#4a3a05' },
  { bg: '#b6d0b8', fg: '#313c33' },
  { bg: '#49a094', fg: '#ffffff' },
  { bg: '#1f655f', fg: '#ffffff' },
]

interface PanelHero {
  characterId: number
  name: string
  image: string
  level: number
}

// Only base heroes carry paragon; companions and phantimals are excluded.
const heroesFor = (team: Team): PanelHero[] =>
  getTilesWithCharactersByTeam(props.context.grid, team)
    .filter((tile) => tile.characterId !== undefined && isBaseHeroId(tile.characterId))
    .map((tile) => {
      const characterId = tile.characterId!
      const canonicalName = gameData.getCharacterNameById(characterId) ?? ''
      return {
        characterId,
        name: localizedDisplayName(i18n.t, 'character', canonicalName),
        image: gameData.getCharacterImage(canonicalName),
        level: props.context.getParagon(team, characterId),
      }
    })

const allyHeroes = computed(() => heroesFor(Team.ALLY))
const enemyHeroes = computed(() => heroesFor(Team.ENEMY))

// The enemy net is the negation of allyNet (the two mirror), so sides reuses it.
const allyNet = computed(() =>
  teamPowerNet(
    allyHeroes.value.map((h) => h.level),
    enemyHeroes.value.map((h) => h.level),
  ),
)

const sides = computed(() => [
  { team: Team.ALLY, klass: 'ally', heroes: allyHeroes.value, net: allyNet.value },
  { team: Team.ENEMY, klass: 'enemy', heroes: enemyHeroes.value, net: -allyNet.value },
])

// Team view crops the grid to the ally side, so the panel drops the enemy column to
// match. The ally net still accounts for the (now hidden) enemy's paragon.
const visibleSides = computed(() =>
  props.context.teamView ? sides.value.filter((side) => side.team === Team.ALLY) : sides.value,
)

const cycle = (team: Team, hero: PanelHero): void => {
  props.context.setParagon(team, hero.characterId, (hero.level + 1) % (PARAGON_MAX_LEVEL + 1))
}

const badgeStyle = (level: number) => {
  const c = PARAGON_COLORS[level] ?? PARAGON_COLORS[0]!
  return { background: c.bg, color: c.fg }
}

const netClass = (net: number): string => (net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero')

const netLabel = (net: number): string =>
  net > 0 ? i18n.t('app.inspiration') : net < 0 ? i18n.t('app.intimidation') : i18n.t('app.even')

const formatNet = (net: number): string => {
  const magnitude = Number.isInteger(net) ? String(Math.abs(net)) : Math.abs(net).toFixed(1)
  const sign = net > 0 ? '+' : net < 0 ? '-' : ''
  return `${sign}${magnitude}%`
}
</script>

<template>
  <div class="team-power" :class="{ single: visibleSides.length === 1 }">
    <div v-for="side in visibleSides" :key="side.klass" class="tp-block" :class="side.klass">
      <div class="tp-head">
        <span class="net" :class="netClass(side.net)">
          <span class="net-label" tabindex="0">
            {{ netLabel(side.net) }}
            <span class="net-tip">{{ i18n.t('app.team-power-info') }}</span>
          </span>
          <span class="net-num">{{ formatNet(side.net) }}</span>
        </span>
      </div>
      <div class="heroes">
        <button
          v-for="hero in side.heroes"
          :key="hero.characterId"
          type="button"
          class="hero"
          :aria-label="`${hero.name}, paragon ${hero.level}`"
          :title="i18n.t('app.paragon-cycle')"
          @click="cycle(side.team, hero)"
        >
          <span class="portrait-wrap">
            <span class="portrait">
              <img v-if="hero.image" class="portrait-img" :src="hero.image" alt="" />
            </span>
            <span class="pbadge" :style="badgeStyle(hero.level)">P{{ hero.level }}</span>
          </span>
          <span class="hero-name" :title="hero.name">{{ hero.name }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* A flat strip seated between the grid and the controls. Sized by container width
   so it reads well both wide (Arena) and narrow (a 5 v 5 board). */
.team-power {
  container-type: inline-size;
  display: flex;
  width: 100%;
  margin-top: var(--spacing-lg);
  /* Bottom gap as padding, not margin: the image export captures the border-box, so
     padding rides along (keeping the names off the edge) while a margin would not. */
  padding-bottom: var(--spacing-md);
}

.tp-block {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-md) var(--spacing-md);
}
.tp-block.ally {
  background: rgba(54, 149, 142, 0.05);
}
.tp-block.enemy {
  background: rgba(200, 35, 51, 0.05);
  border-left: 1px solid var(--color-border-primary);
}
/* Team view shows one side: it fills the full width (the default flex: 1), and its
   heroes spread across so the removed enemy half doesn't read as empty. Spreading
   only takes effect when the row has slack: a full team on a narrow board still
   sizes up to fill edge to edge. */
.team-power.single .heroes {
  justify-content: space-evenly;
}

.tp-head {
  display: flex;
  min-height: 28px;
  margin-bottom: var(--spacing-sm);
}
/* Mirror the enemy header: number inward, label at the outer edge. */
.tp-block.enemy .tp-head {
  justify-content: flex-end;
}
.tp-block.enemy .net {
  flex-direction: row-reverse;
}

.net {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}
/* Subtle: the label is a quiet caption and the tooltip handle, not the headline. */
.net-label {
  position: relative;
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px dotted var(--color-border-primary);
  cursor: help;
  outline: none;
}
/* Pronounced: the number is the headline, colored by sign (buff teal / debuff red). */
.net-num {
  font-weight: 800;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.net.pos .net-num {
  color: var(--color-success);
}
.net.neg .net-num {
  color: var(--color-enemy);
}
.net.zero .net-num {
  color: var(--color-text-secondary);
}

.net-tip {
  position: absolute;
  top: 150%;
  left: 0;
  width: 240px;
  background: #2b2b2b;
  color: #f3f3f3;
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
  line-height: 1.45;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-medium);
  box-shadow: var(--shadow-medium);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.12s ease;
  z-index: 30;
  text-align: left;
}
.tp-block.enemy .net-tip {
  left: auto;
  right: 0;
}
.net-label:hover .net-tip,
.net-label:focus .net-tip {
  opacity: 1;
  visibility: visible;
}

.heroes {
  display: flex;
  flex-wrap: nowrap;
  --hero-gap: 4px;
  gap: var(--hero-gap);
}
.tp-block.enemy .heroes {
  justify-content: flex-end;
}

/* Each team has up to 5 heroes: a fixed fifth-of-the-column basis (no grow, no wrap)
   makes them fill exactly one row when full, stays a consistent size when fewer, and
   tracks the column width without wrapping. Capped at the roster icon size (70px, see
   CharacterIcon) so they never grow larger than a character-selection icon. */
.hero {
  flex: 0 0 calc((100% - 4 * var(--hero-gap)) / 5);
  min-width: 0;
  max-width: 70px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
}
/* A size container so the corner badge can scale with the column-driven icon. */
.portrait-wrap {
  container-type: inline-size;
  position: relative;
  width: 100%;
  line-height: 0;
}
/* Oversized image centered in an overflow-clipped circle (mirrors CharacterIcon)
   so the portrait frames the face instead of sitting too high. The circle fills its
   flex-sized cell, so it scales with the column width. */
.portrait {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid #fff;
  background-color: var(--color-bg-secondary);
  transition: transform 0.12s ease;
}
.portrait-img {
  display: block;
  width: 116%;
  height: 116%;
  object-fit: cover;
}
.hero:hover .portrait {
  transform: scale(1.06);
}
/* Sized in cqw (a share of the icon width) so it stays a corner badge as the icon
   scales, with px floors that keep "P#" legible on the smallest boards. */
.pbadge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: max(14px, 36cqw);
  height: max(14px, 36cqw);
  padding: 0 3px;
  border-radius: 999px;
  font-size: max(7px, 19cqw);
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
}
.hero-name {
  display: none;
  max-width: 100%;
  font-size: 0.64rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Wider container (the Arena): roomier padding, a bigger net number, and visible
   hero names. Icon sizing stays flex-driven so the row never wraps. */
@container (min-width: 480px) {
  .tp-block {
    padding: var(--spacing-md) var(--spacing-lg);
  }
  .net-num {
    font-size: 1.5rem;
  }
  .hero-name {
    display: block;
  }
}
</style>
