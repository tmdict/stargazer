<script setup lang="ts">
import { computed } from 'vue'

import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useAttrLayerSelection } from '@/composables/useAttrLayerSelection'
import type { GridContext } from '@/composables/useGridContext'
import { useInfoTip } from '@/composables/useInfoTip'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax } from '@/lib/characters/attributes'
import { getTilesWithCharactersByTeam, isRealHeroId } from '@/lib/characters/character'
import { teamPowerNet } from '@/lib/characters/paragon'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  context: GridContext
  // Badge layers (display); the armed-layer selection decides which of the
  // visible layers portrait taps edit. Off, the panel is portraits and names.
  showParagon: boolean
  showRefinement?: boolean
  readonly?: boolean
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()
const { effectiveLayers } = useAttrLayerSelection()

interface PanelHero {
  characterId: number
  name: string
  image: string
  paragon: number
  refinement: number
  faction?: string
}

// Only real heroes carry upgrade attrs.
const heroesFor = (team: Team): PanelHero[] =>
  getTilesWithCharactersByTeam(props.context.grid, team)
    .filter((tile) => tile.characterId !== undefined && isRealHeroId(tile.characterId))
    .map((tile) => {
      const characterId = tile.characterId!
      const canonicalName = gameData.getCharacterNameById(characterId) ?? ''
      return {
        characterId,
        name: localizedDisplayName(i18n.t, 'character', canonicalName),
        image: gameData.getCharacterImage(canonicalName),
        paragon: props.context.getAttr(team, characterId, ATTR_PARAGON),
        refinement: props.context.getAttr(team, characterId, ATTR_REFINEMENT),
        faction: gameData.getCharacterFaction(characterId),
      }
    })

const allyHeroes = computed(() => heroesFor(Team.ALLY))
const enemyHeroes = computed(() => heroesFor(Team.ENEMY))

// Net Rivalry-mode stat (Inspiration minus the enemy's Intimidation), driven by
// paragon alone. The enemy's is the negation of the ally's (the two mirror).
const allyRivalryStat = computed(() =>
  teamPowerNet(
    allyHeroes.value.map((hero) => ({ level: hero.paragon, faction: hero.faction })),
    enemyHeroes.value.map((hero) => ({ level: hero.paragon, faction: hero.faction })),
  ),
)

const visibleAttrIds = computed(() => [
  ...(props.showParagon ? [ATTR_PARAGON] : []),
  ...(props.showRefinement ? [ATTR_REFINEMENT] : []),
])

// A hidden badge layer is never edited: taps act on armed ∩ visible (falling
// back to the visible layers), and with no layer visible they no-op.
const editLayers = computed(() => (props.readonly ? [] : effectiveLayers(visibleAttrIds.value)))
const canEdit = computed(() => editLayers.value.length > 0)

const sides = computed(() => [
  { team: Team.ALLY, klass: 'ally', heroes: allyHeroes.value, rivalryStat: allyRivalryStat.value },
  {
    team: Team.ENEMY,
    klass: 'enemy',
    heroes: enemyHeroes.value,
    rivalryStat: -allyRivalryStat.value,
  },
])

// An empty side would render as a blank half; team view crops the grid to the
// ally side, so the panel follows.
const visibleSides = computed(() => {
  const populated = sides.value.filter((side) => side.heroes.length > 0)
  return props.context.teamView ? populated.filter((side) => side.team === Team.ALLY) : populated
})

// One armed layer cycles with wrap (as paragon taps always have). Both armed:
// +1 clamped so counters at different values can't desync — except when every
// armed layer is already maxed, when the tap wraps them all to 0 together.
const cycle = (team: Team, hero: PanelHero): void => {
  const layers = editLayers.value
  if (layers.length === 1) {
    const attrId = layers[0]!
    const current = props.context.getAttr(team, hero.characterId, attrId)
    props.context.setAttr(team, hero.characterId, attrId, (current + 1) % (attrMax(attrId) + 1))
    return
  }
  const values = layers.map(
    (attrId) => [attrId, props.context.getAttr(team, hero.characterId, attrId)] as const,
  )
  const allMaxed = values.every(([attrId, value]) => value >= attrMax(attrId))
  for (const [attrId, value] of values) {
    props.context.setAttr(team, hero.characterId, attrId, allMaxed ? 0 : value + 1)
  }
}

// Paragon colors max only; refinement warms up in two steps (0-1 gray,
// 2-3 light tint, 4 full red) so mid progress shows without stealing the
// maxed pop. When both layers show, the fills meet in a slanted seam; a
// single visible layer renders as a one-color chip.
const PILL_GRAY = '#cfc8bb'
const PILL_MAX_P = '#8fa7c8'
const PILL_MID_R = '#f5cdc2'
const PILL_MAX_R = '#e4938a'
const MAX_PARAGON = attrMax(ATTR_PARAGON)
const MAX_REFINEMENT = attrMax(ATTR_REFINEMENT)
const pillBackground = (hero: PanelHero): string => {
  const pFill = hero.paragon >= MAX_PARAGON ? PILL_MAX_P : PILL_GRAY
  const rFill =
    hero.refinement >= MAX_REFINEMENT ? PILL_MAX_R : hero.refinement >= 2 ? PILL_MID_R : PILL_GRAY
  if (props.showParagon && props.showRefinement) {
    // The white sliver keeps the slanted split visible even when both halves
    // share the gray, so the pill reads the same at every level combination.
    return `linear-gradient(112deg, ${pFill} 48.6%, #fff 49.4%, #fff 50.6%, ${rFill} 51.4%)`
  }
  return props.showParagon ? pFill : rFill
}

const heroAria = (hero: PanelHero): string => {
  const parts = [hero.name]
  if (props.showParagon) parts.push(`${i18n.t('app.paragon')} ${hero.paragon}`)
  if (props.showRefinement) parts.push(`${i18n.t('app.refinement')} ${hero.refinement}`)
  return parts.join(', ')
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
// flips sign while the label is hovered.
const {
  anchor: hoveredStatEl,
  payload: hoveredTeam,
  hoverOpen: onStatEnter,
  hoverClose: onStatLeave,
  toggle: onStatToggle,
  onTouchStart: onStatTouchStart,
} = useInfoTip<Team>()
const hoveredStat = computed(
  () => sides.value.find((side) => side.team === hoveredTeam.value)?.rivalryStat ?? 0,
)
</script>

<template>
  <div
    v-if="visibleSides.length > 0"
    class="team-power capture-exclude"
    :class="{ single: visibleSides.length === 1 }"
  >
    <div v-for="side in visibleSides" :key="side.klass" class="tp-block" :class="side.klass">
      <div v-if="showParagon" class="tp-head">
        <span class="stat" :class="rivalryStatClass(side.rivalryStat)">
          <span class="stat-num">{{ formatRivalryStat(side.rivalryStat) }}</span>
          <span
            v-if="side.rivalryStat !== 0"
            class="stat-label"
            @mouseenter="onStatEnter($event, side.team)"
            @mouseleave="onStatLeave"
            @click="onStatToggle($event, side.team)"
            @touchstart.passive="onStatTouchStart"
          >
            {{ rivalryStatName(side.rivalryStat) }}
          </span>
        </span>
      </div>
      <div class="heroes">
        <button
          v-for="hero in side.heroes"
          :key="hero.characterId"
          type="button"
          class="hero"
          :class="{ static: !canEdit }"
          :aria-label="heroAria(hero)"
          :title="canEdit ? i18n.t('app.upgrade-cycle') : undefined"
          @click="canEdit && cycle(side.team, hero)"
        >
          <span class="portrait-wrap">
            <span class="portrait">
              <img v-if="hero.image" class="portrait-img" :src="hero.image" alt="" />
            </span>
          </span>
          <span
            v-if="showParagon || showRefinement"
            class="upill"
            :style="{ background: pillBackground(hero) }"
          >
            <span v-if="showParagon" class="useg" :class="{ max: hero.paragon >= MAX_PARAGON }">
              P{{ hero.paragon }}
            </span>
            <span
              v-if="showRefinement"
              class="useg"
              :class="{ max: hero.refinement >= MAX_REFINEMENT }"
            >
              R{{ hero.refinement }}
            </span>
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
        <template #content>{{ rivalryStatInfo(hoveredStat) }}</template>
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
/* A lone side fills the full width, so spread its heroes rather than let the
   missing half read as empty. Takes effect only when the row has slack. */
.team-power.single .heroes {
  justify-content: space-evenly;
}
/* Enemy-only: no second block, so no seam. */
.team-power.single .tp-block.enemy {
  border-left: none;
}

.tp-head {
  display: flex;
  min-height: 28px;
  margin-bottom: var(--spacing-md);
}
/* Mirror the sides: each stat sits at its block's outer edge, number
   outermost, caption toward the center seam. */
.tp-block.enemy .tp-head {
  justify-content: flex-end;
}
.tp-block.enemy .stat {
  flex-direction: row-reverse;
}

/* Number beside caption on the shared baseline; the head holds nothing else
   now that editing lives in the dock. */
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
@container (max-width: 319px) {
  .stat-label {
    display: none;
  }
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
/* A size container so the corner badges can scale with the column-driven icon. */
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
/* Not editable (share view, or no layer visible): no click affordance. */
.hero.static {
  cursor: default;
}
.hero.static:hover .portrait {
  transform: none;
}
/* The upgrade pill seats on the portrait's bottom edge (no corner overhang, so
   neighboring heroes can never collide) with the numbers centered per half. */
.upill {
  display: inline-flex;
  border-radius: 999px;
  overflow: hidden;
  border: 1.5px solid #fff;
  margin-top: -7px;
  position: relative;
  z-index: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
  line-height: 1;
  font-size: 7.5px;
  font-weight: 800;
  letter-spacing: 0.02em;
}
/* Vertical padding is asymmetric on purpose: at line-height 1 the font's
   descender space hangs below the baseline, and P/R levels never use it, so
   symmetric padding reads as the glyphs floating high. */
.useg {
  flex: 1 1 0;
  min-width: 17px;
  padding: 2.4px 3px 1.6px;
  text-align: center;
  color: #4a463d;
}
/* A lone visible layer keeps pill proportions instead of shrinking to a
   near-circle around its two characters. */
.useg:only-child {
  min-width: 30px;
  padding: 2.4px 6px 1.6px;
}
.useg.max {
  color: #fff;
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
  .upill {
    font-size: 9px;
    margin-top: -9px;
  }
  .useg {
    min-width: 21px;
    padding: 3px 4px 2px;
  }
  .useg:only-child {
    min-width: 36px;
    padding: 3px 7px 2px;
  }
}
</style>
