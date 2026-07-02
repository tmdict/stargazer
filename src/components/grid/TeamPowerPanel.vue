<script setup lang="ts">
import { computed, ref } from 'vue'

import IconReset from '@/components/ui/IconReset.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { GridContext } from '@/composables/useGridContext'
import { useTouchDetection } from '@/composables/useTouchDetection'
import { getTilesWithCharactersByTeam, isBaseHeroId } from '@/lib/characters/character'
import { PARAGON_MAX_LEVEL, teamPowerNet } from '@/lib/characters/paragon'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{ context: GridContext; readonly?: boolean }>()

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
  faction?: string
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
        faction: gameData.getCharacterFaction(characterId),
      }
    })

const allyHeroes = computed(() => heroesFor(Team.ALLY))
const enemyHeroes = computed(() => heroesFor(Team.ENEMY))

// Grid Info gates the panel, but an empty grid has nothing to show, so the panel
// only renders once a hero is placed.
const hasHeroes = computed(() => allyHeroes.value.length > 0 || enemyHeroes.value.length > 0)

// Net Rivalry-mode stat (Inspiration minus the enemy's Intimidation). The enemy's is
// the negation of the ally's (the two mirror), so sides reuses it.
const allyRivalryStat = computed(() => teamPowerNet(allyHeroes.value, enemyHeroes.value))

const sides = computed(() => [
  { team: Team.ALLY, klass: 'ally', heroes: allyHeroes.value, rivalryStat: allyRivalryStat.value },
  {
    team: Team.ENEMY,
    klass: 'enemy',
    heroes: enemyHeroes.value,
    rivalryStat: -allyRivalryStat.value,
  },
])

// Team view crops the grid to the ally side, so the panel drops the enemy column to
// match. The ally stat still accounts for the hidden enemy's paragon.
const visibleSides = computed(() =>
  props.context.teamView ? sides.value.filter((side) => side.team === Team.ALLY) : sides.value,
)

const cycle = (team: Team, hero: PanelHero): void => {
  props.context.setParagon(team, hero.characterId, (hero.level + 1) % (PARAGON_MAX_LEVEL + 1))
}

const hasParagon = (heroes: PanelHero[]): boolean => heroes.some((hero) => hero.level > 0)

const resetParagons = (team: Team, heroes: PanelHero[]): void => {
  heroes.forEach((hero) => props.context.setParagon(team, hero.characterId, 0))
}

const badgeStyle = (level: number) => {
  const c = PARAGON_COLORS[level] ?? PARAGON_COLORS[0]!
  return { background: c.bg, color: c.fg }
}

const rivalryStatClass = (stat: number): string => (stat > 0 ? 'pos' : stat < 0 ? 'neg' : 'zero')

// The label is hidden when the stat is 0 (the v-if), so only the two signs reach here.
const rivalryStatName = (stat: number): string =>
  stat > 0 ? i18n.t('app.inspiration') : i18n.t('app.intimidation')

// Inspiration (positive) and Intimidation (negative) have separate in-game
// descriptions; the panel hides the tooltip at 0, so even never reaches here.
const rivalryStatInfo = (stat: number): string =>
  stat < 0 ? i18n.t('app.intimidation-info') : i18n.t('app.inspiration-info')

const formatRivalryStat = (stat: number): string => {
  const magnitude = Number.isInteger(stat) ? String(Math.abs(stat)) : Math.abs(stat).toFixed(1)
  const sign = stat > 0 ? '+' : stat < 0 ? '-' : ''
  return `${sign}${magnitude}%`
}

// Track the hovered side, not its value, so the tooltip text stays live if the stat
// flips sign while the label is hovered. Touch-suppressed like the roster tooltips.
const { isTouchDevice } = useTouchDetection()
const hoveredStatEl = ref<HTMLElement | null>(null)
const hoveredTeam = ref<Team | null>(null)
const hoveredStat = computed(
  () => sides.value.find((side) => side.team === hoveredTeam.value)?.rivalryStat ?? 0,
)
const onStatEnter = (event: MouseEvent, team: Team): void => {
  if (isTouchDevice.value) return
  hoveredStatEl.value = event.currentTarget as HTMLElement
  hoveredTeam.value = team
}
const onStatLeave = (): void => {
  hoveredStatEl.value = null
  hoveredTeam.value = null
}
</script>

<template>
  <div v-if="hasHeroes" class="team-power" :class="{ single: visibleSides.length === 1 }">
    <div v-for="side in visibleSides" :key="side.klass" class="tp-block" :class="side.klass">
      <div class="tp-head">
        <span class="stat" :class="rivalryStatClass(side.rivalryStat)">
          <span
            v-if="side.rivalryStat !== 0"
            class="stat-label"
            @mouseenter="onStatEnter($event, side.team)"
            @mouseleave="onStatLeave"
          >
            {{ rivalryStatName(side.rivalryStat) }}
          </span>
          <span class="stat-num">{{ formatRivalryStat(side.rivalryStat) }}</span>
        </span>
        <button
          v-if="hasParagon(side.heroes) && !readonly"
          type="button"
          class="stat-reset"
          :aria-label="i18n.t('app.reset-paragons')"
          :title="i18n.t('app.reset-paragons')"
          @click="resetParagons(side.team, side.heroes)"
        >
          <IconReset :size="11" />
        </button>
      </div>
      <div class="heroes">
        <button
          v-for="hero in side.heroes"
          :key="hero.characterId"
          type="button"
          class="hero"
          :class="{ readonly }"
          :aria-label="`${hero.name}, paragon ${hero.level}`"
          :title="readonly ? undefined : i18n.t('app.paragon-cycle')"
          @click="!readonly && cycle(side.team, hero)"
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

    <Teleport to="body">
      <TooltipPopup
        v-if="hoveredStatEl && hoveredStat !== 0"
        :target-element="hoveredStatEl"
        variant="detailed"
        max-width="260px"
      >
        <template #content>
          <p class="stat-tip">{{ rivalryStatInfo(hoveredStat) }}</p>
        </template>
      </TooltipPopup>
    </Teleport>
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
  align-items: center;
  gap: var(--spacing-sm);
  min-height: 28px;
  margin-bottom: var(--spacing-md);
}
/* Reverse the enemy header so its label and reset button sit at the outer edge with
   the number inward, mirroring the ally side. */
.tp-block.enemy .tp-head {
  flex-direction: row-reverse;
}
.tp-block.enemy .stat {
  flex-direction: row-reverse;
}

.stat {
  display: inline-flex;
  align-items: baseline;
  gap: var(--spacing-sm);
}
/* Subtle: the label is a quiet caption and the tooltip handle, not the headline. */
.stat-label {
  font-size: 0.62rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  border-bottom: 1px dotted var(--color-border-primary);
  cursor: help;
}
/* Headline number, colored by sign. The negative uses the calmer danger red (not the
   alert enemy red) so it balances the teal rather than dominating it. */
.stat-num {
  font-weight: 700;
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1;
}
.stat.pos .stat-num {
  color: var(--color-success);
}
.stat.neg .stat-num {
  color: var(--color-danger);
}
.stat.zero .stat-num {
  color: var(--color-text-secondary);
}

.stat-reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.stat-reset:hover {
  background: rgba(0, 0, 0, 0.11);
  color: var(--color-text-primary);
}

/* Tooltip body text; the frosted background, blur, and color come from TooltipPopup. */
.stat-tip {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.45;
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
/* Read-only (share view): the hero is shown, not cyclable. */
.hero.readonly {
  cursor: default;
}
.hero.readonly:hover .portrait {
  transform: none;
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

/* Wider container (the Arena): roomier padding, a bigger stat number, and visible
   hero names. Icon sizing stays flex-driven so the row never wraps. */
@container (min-width: 480px) {
  .tp-block {
    padding: var(--spacing-md) var(--spacing-lg);
  }
  .stat-num {
    font-size: 1.3rem;
  }
  .hero-name {
    display: block;
  }
}
</style>
