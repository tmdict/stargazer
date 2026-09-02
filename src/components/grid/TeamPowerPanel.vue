<script setup lang="ts">
import { computed } from 'vue'

import IconChevronsUp from '@/components/ui/IconChevronsUp.vue'
import IconReset from '@/components/ui/IconReset.vue'
import IconTrashSmall from '@/components/ui/IconTrashSmall.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import type { GridContext } from '@/composables/useGridContext'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useInfoTip } from '@/composables/useInfoTip'
import { useSelectionState } from '@/composables/useSelectionState'
import { getTilesWithCharactersByTeam, isRealHeroId } from '@/lib/characters/character'
import { PARAGON_MAX_LEVEL, teamPowerNet } from '@/lib/characters/paragon'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'

const props = defineProps<{
  context: GridContext
  // Paragon layer (badges, cycle, bulk actions, rivalry stat header); off, the
  // panel is portraits, names, and the per-team clear.
  showParagon: boolean
  readonly?: boolean
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

interface PanelHero {
  characterId: number
  name: string
  image: string
  level: number
  faction?: string
}

// Only real heroes carry paragon.
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
        level: props.context.getParagon(team, characterId),
        faction: gameData.getCharacterFaction(characterId),
      }
    })

const allyHeroes = computed(() => heroesFor(Team.ALLY))
const enemyHeroes = computed(() => heroesFor(Team.ENEMY))

// Net Rivalry-mode stat (Inspiration minus the enemy's Intimidation). The enemy's is
// the negation of the ally's (the two mirror), so sides reuses it.
const allyRivalryStat = computed(() => teamPowerNet(allyHeroes.value, enemyHeroes.value))

const canEditParagon = computed(() => !props.readonly && props.showParagon)

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

const cycle = (team: Team, hero: PanelHero): void => {
  props.context.setParagon(team, hero.characterId, (hero.level + 1) % (PARAGON_MAX_LEVEL + 1))
}

const hasParagon = (heroes: PanelHero[]): boolean => heroes.some((hero) => hero.level > 0)

const resetParagons = (team: Team, heroes: PanelHero[]): void => {
  hideActionTip()
  heroes.forEach((hero) => props.context.setParagon(team, hero.characterId, 0))
}

// Clamped, unlike the per-hero cycle: a batch wrap would zero a maxed team.
// At all-P4 the raise buttons disable instead of hiding; removal would slide
// reset under a rapidly clicking cursor.
const canRaise = (heroes: PanelHero[]): boolean =>
  heroes.some((hero) => hero.level < PARAGON_MAX_LEVEL)

const raiseAll = (team: Team, heroes: PanelHero[]): void => {
  hideActionTip()
  heroes.forEach((hero) =>
    props.context.setParagon(team, hero.characterId, Math.min(hero.level + 1, PARAGON_MAX_LEVEL)),
  )
}

const maxAll = (team: Team, heroes: PanelHero[]): void => {
  hideActionTip()
  heroes.forEach((hero) => props.context.setParagon(team, hero.characterId, PARAGON_MAX_LEVEL))
}

// Per-team wipe, two-step armed like every destructive control. Bulk removal
// may delete the unit a pending tap/lift gesture references, so the gesture
// state drops with it (as every other bulk mutation does).
const { armed, confirm } = useArmedConfirm()
const { clearTargetHex, clearLiftedHex } = useSelectionState()
const clearTeam = (team: Team): void => {
  if (!confirm(String(team))) return
  hideActionTip()
  props.context.clearTeam(team)
  clearTargetHex()
  clearLiftedHex()
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

// Bulk-action tooltips: the handlers close the popup themselves, because a
// click can disable (+1, max) or remove (reset) the hovered button, and it
// then never fires the closing mouseleave.
const {
  anchor: actionTipEl,
  payload: actionTipKey,
  onMouseEnter: showActionTip,
  onMouseLeave: hideActionTip,
  onTouchStart: onActionTouchStart,
} = useHoverTooltip<string>()

const actionTipText = computed((): string => (actionTipKey.value ? i18n.t(actionTipKey.value) : ''))
</script>

<template>
  <div
    v-if="visibleSides.length > 0"
    class="team-power capture-exclude"
    :class="{ single: visibleSides.length === 1 }"
  >
    <div v-for="side in visibleSides" :key="side.klass" class="tp-block" :class="side.klass">
      <!-- The head renders without the paragon layer too: the per-team clear
           is available whenever the panel is editable. -->
      <div v-if="showParagon || !readonly" class="tp-head">
        <span v-if="showParagon" class="stat" :class="rivalryStatClass(side.rivalryStat)">
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
        <span v-if="!readonly" class="tp-actions">
          <template v-if="canEditParagon">
            <button
              v-if="hasParagon(side.heroes)"
              type="button"
              class="stat-reset"
              :aria-label="i18n.t('app.reset-paragons')"
              @click="resetParagons(side.team, side.heroes)"
              @mouseenter="showActionTip($event, 'app.reset-paragons')"
              @touchstart.passive="onActionTouchStart"
              @mouseleave="hideActionTip"
            >
              <IconReset :size="11" />
            </button>
            <button
              type="button"
              class="stat-max"
              :disabled="!canRaise(side.heroes)"
              :aria-label="i18n.t('app.max-paragons')"
              @click="maxAll(side.team, side.heroes)"
              @mouseenter="showActionTip($event, 'app.max-paragons')"
              @touchstart.passive="onActionTouchStart"
              @mouseleave="hideActionTip"
            >
              <IconChevronsUp :size="11" />
            </button>
            <button
              type="button"
              class="stat-plus"
              :disabled="!canRaise(side.heroes)"
              :aria-label="i18n.t('app.raise-paragons')"
              @click="raiseAll(side.team, side.heroes)"
              @mouseenter="showActionTip($event, 'app.raise-paragons')"
              @touchstart.passive="onActionTouchStart"
              @mouseleave="hideActionTip"
            >
              +1
            </button>
            <span class="tp-actions-divider" />
          </template>
          <button
            type="button"
            class="stat-clear"
            :class="{ armed: armed === String(side.team) }"
            :aria-label="i18n.t('app.clear-team')"
            @click="clearTeam(side.team)"
            @mouseenter="showActionTip($event, 'app.clear-team')"
            @touchstart.passive="onActionTouchStart"
            @mouseleave="hideActionTip"
          >
            <IconTrashSmall :size="12" />
          </button>
        </span>
      </div>
      <div class="heroes">
        <button
          v-for="hero in side.heroes"
          :key="hero.characterId"
          type="button"
          class="hero"
          :class="{ static: !canEditParagon }"
          :aria-label="showParagon ? `${hero.name}, paragon ${hero.level}` : hero.name"
          :title="canEditParagon ? i18n.t('app.paragon-cycle') : undefined"
          @click="canEditParagon && cycle(side.team, hero)"
        >
          <span class="portrait-wrap">
            <span class="portrait">
              <img v-if="hero.image" class="portrait-img" :src="hero.image" alt="" />
            </span>
            <span v-if="showParagon" class="pbadge" :class="`p${hero.level}`">
              P{{ hero.level }}
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
      <TooltipPopup
        v-if="actionTipKey && actionTipEl"
        :target-element="actionTipEl"
        variant="detailed"
      >
        <template #content>{{ actionTipText }}</template>
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
  /* Never bleed into the neighboring block: anything the row can't fit wraps
     below instead (a rare, graceful second line). */
  flex-wrap: wrap;
  /* Top-aligned so the chips sit on the stat's number line, not centered
     against the taller number-plus-caption stack. */
  align-items: flex-start;
  gap: var(--spacing-sm);
  min-height: 28px;
  margin-bottom: var(--spacing-md);
}
/* Reverse the enemy header so the sides mirror: stat at the outer edge, actions
   against the center seam. */
.tp-block.enemy .tp-head {
  flex-direction: row-reverse;
}
.tp-block.enemy .stat {
  align-items: flex-end;
}
.tp-block.enemy .tp-actions {
  flex-direction: row-reverse;
  margin-left: 0;
  margin-right: auto;
}

/* Number over caption: stacked, the stat is only as wide as its longest line,
   which lets narrower blocks keep the caption. */
.stat {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
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
/* Tight container: the caption would shove the action chips across the block
   boundary (stacked, a side needs ~230px: caption ~85px beside ~110px of
   chips plus padding), so the number alone carries the stat. Container width,
   not viewport, is the real constraint — a single-block team view keeps its
   caption at widths where two blocks must drop theirs. */
@container (max-width: 499px) {
  .tp-block:not(:only-child) .stat-label {
    display: none;
  }
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

/* Anchored to the block edge nearest the seam: the stat text ahead changes
   width and must never shove a button mid-press. +1 sits outermost so reset,
   which appears with the first paragon, grows the cluster inward. */
.tp-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
  margin-left: auto;
}

.stat-plus,
.stat-max,
.stat-reset,
.stat-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.stat-plus,
.stat-max {
  width: 20px;
  height: 20px;
}
.stat-plus {
  font-size: 0.62rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.stat-reset,
.stat-clear {
  width: 18px;
  height: 18px;
}
.stat-plus:hover:not(:disabled),
.stat-max:hover:not(:disabled),
.stat-reset:hover {
  background: rgba(0, 0, 0, 0.11);
  color: var(--color-text-primary);
}

/* Sets the destructive clear apart from the repeatable paragon cluster. */
.tp-actions-divider {
  width: 1px;
  height: 18px;
  background: var(--color-border-primary);
}
.stat-clear {
  color: var(--color-danger);
}
.stat-clear:hover,
.stat-clear.armed {
  background: var(--color-danger);
  color: #fff;
}
/* Armed step of the two-step confirm: ring plus the shared confirm-ping pulse
   (controls.css), so the state reads even at chip size. */
.stat-clear.armed {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 40%, transparent);
  animation: confirm-ping 0.9s ease-out infinite;
}
@media (prefers-reduced-motion: reduce) {
  .stat-clear.armed {
    animation: none;
  }
}
.stat-plus:disabled,
.stat-max:disabled {
  opacity: 0.35;
  cursor: default;
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
/* Not cyclable (share view, or paragon hidden): no click affordance. */
.hero.static {
  cursor: default;
}
.hero.static:hover .portrait {
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
/* P0 (no paragon) sits off the tier ramp; P4's pale silver fill is the one
   that can't carry the white text the other tiers use. */
.pbadge.p0 {
  background: #cfc8bb;
  color: #4a463d;
}
.pbadge.p1 {
  background: var(--color-tier-1);
  color: #fff;
}
.pbadge.p2 {
  background: var(--color-tier-2);
  color: #fff;
}
.pbadge.p3 {
  background: var(--color-tier-3);
  color: #fff;
}
.pbadge.p4 {
  background: var(--color-tier-4);
  color: #1f2b3d;
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
