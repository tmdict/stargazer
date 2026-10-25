<script setup lang="ts">
/* The Supreme League generator: for the heroes and levels a visitor picks,
   the set of five recorded teams, one per map and no hero twice, with the
   best chance to win a match (lib/pvp/sl). The picker edits a copy of the
   active roster, so trying a hero out never changes the roster, and picking
   or importing another roster takes a fresh copy. The set is chosen only on
   Generate and stays as it is while the selection changes, and Save as team
   opens the saved set on the Teams page. The page is pre-rendered with its
   heading alone: the picker and the set follow the visitor's rosters, which
   the browser holds, so they are drawn after mount. */

import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import SlAbout from '@/components/guide/sl/SlAbout.vue'
import SlBar from '@/components/guide/sl/SlBar.vue'
import SlResult, { type SlShown } from '@/components/guide/sl/SlResult.vue'
import RosterEditor from '@/components/RosterEditor.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { slPercent } from '@/components/guide/sl/useSlNames'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { useInfoTip } from '@/composables/useInfoTip'
import { useToast } from '@/composables/useToast'
import {
  ATTR_PARAGON,
  ATTR_REFINEMENT,
  attrMax,
  type AttrRecord,
} from '@/lib/characters/attributes'
import { chooseSlSet } from '@/lib/pvp/sl/chooser'
import { loadSlData } from '@/lib/pvp/sl/codec'
import { slTeamData } from '@/lib/pvp/sl/team'
import type { SlData, SlPick, SlSample } from '@/lib/pvp/sl/types'
import { canonicalLevels } from '@/lib/rosters'
import { isRetiredSeason } from '@/lib/seasonal'
import { MAX_SAVED_TEAMS, TEAM_VARIANTS } from '@/lib/teams/modes'
import { reloadOntoCurrentBuild } from '@/router/routes'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { useTeamLibrary } from '@/stores/teamLibrary'
import { setupSlContentMeta } from '@/utils/contentMeta'

import '@/components/guide/sl/sl.css'

const i18n = useI18nStore()
setupSlContentMeta(computed(() => i18n.currentLocale))

const gameData = useGameDataStore()
gameData.initializeData()
const rosters = useRosters()
const library = useTeamLibrary()
const route = useRoute()
const router = useRouter()
const { error, success } = useToast()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

const {
  anchor: betaAnchor,
  hoverOpen: betaOpen,
  hoverClose: betaClose,
  toggle: betaToggle,
  onTouchStart: betaTouchStart,
} = useInfoTip()

// ---- The file ----

// Plain, never reactive: a proxy over every recorded game would slow the
// chooser, and the decoded data stays out of anything the console can reach.
let data: SlData | null = null
const heading = ref<{
  season: number
  date: string
  rotation: boolean
  retired: boolean
  sample: SlSample | null
  before: (SlSample & { season: number }) | null
} | null>(null)
const aboutOpen = ref(false)
const failed = ref(false)
const mounted = ref(false)

// Floating lists leave the page for <body> (sl.css).
onUnmounted(() => document.documentElement.classList.remove('sl-page-open'))

onMounted(async () => {
  mounted.value = true
  document.documentElement.classList.add('sl-page-open')
  try {
    data = await loadSlData()
  } catch {
    // A tab left open across a deploy asks for a file the deploy replaced.
    if (!reloadOntoCurrentBuild(route.fullPath)) failed.value = true
    return
  }
  heading.value = {
    season: data.season,
    date: data.exportedAt,
    rotation: data.maps.map((m) => m.key).join() !== TEAM_VARIANTS.sl.maps.join(),
    retired: isRetiredSeason(data.season),
    sample: data.sample ?? null,
    before: data.before?.sample ? { season: data.before.season, ...data.before.sample } : null,
  }
})

// ---- The selection ----

// With no roster every hero starts at the top levels, where the recorded
// opponents are counted, so the set is the records' own best.
const TOP: AttrRecord = {
  [ATTR_PARAGON]: attrMax(ATTR_PARAGON),
  [ATTR_REFINEMENT]: attrMax(ATTR_REFINEMENT),
}
const sourceLevels = (id: number): AttrRecord | undefined =>
  rosters.active ? rosters.active.heroes[id] : TOP

const copy = ref<Record<string, AttrRecord>>({})
// Taken again when another roster becomes active, never on the roster object
// itself, which every library write replaces.
watch(
  () => rosters.activeId,
  () => {
    copy.value = rosters.active
      ? { ...rosters.active.heroes }
      : Object.fromEntries(heroes.value.map((c) => [c.id, TOP]))
  },
  { immediate: true },
)

// A hero added here comes back at the levels its roster gives it (the top
// under All heroes), and at 0 only when the roster does not hold it.
const edit = (changes: Record<string, AttrRecord | null>): void => {
  const next = { ...copy.value }
  for (const [key, levels] of Object.entries(changes)) {
    const id = Number(key)
    if (levels === null) delete next[key]
    else if (!next[key]) next[key] = sourceLevels(id) ?? {}
    else next[key] = canonicalLevels(id, levels)
  }
  copy.value = next
}

const armedConfirm = useArmedConfirm()

// ---- Generate ----

const shown = ref<SlShown | null>(null)
const noSet = ref(false)
const busy = ref(false)
const resultEl = useTemplateRef<HTMLElement>('result')

const picksOf = (levels: Record<string, AttrRecord>): SlPick[] =>
  Object.entries(levels).flatMap(([key, record]) => {
    const character = gameData.getCharacterById(Number(key))
    return character
      ? [
          {
            id: character.id,
            faction: character.faction,
            paragon: record[ATTR_PARAGON] ?? 0,
            refinement: record[ATTR_REFINEMENT] ?? 0,
          },
        ]
      : []
  })

const generate = async (): Promise<void> => {
  const file = data
  if (!file) return
  busy.value = true
  // Let the busy state paint before the choice holds the thread.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  const picks = picksOf(copy.value)
  const set = chooseSlSet(file, picks)
  shown.value = set && {
    chance: set.chance,
    odds: set.odds,
    prior: file.prior,
    beforeUnder: file.before ? (file.beforeUnder ?? null) : null,
    teams: set.teams.map((t) => {
      const season = t.source === 0 ? file : file.before!
      const family = t.family === null ? null : season.families[t.family]!
      return {
        map: season.teams[t.team]!.map,
        group: family && { name: family.name, core: family.core },
        comp: t.comp,
        core: t.core,
        flex: t.flex,
        chance: t.chance,
      }
    }),
    data: slTeamData(file, set, picks),
  }
  noSet.value = !set
  busy.value = false
  await nextTick()
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// The saved team holds the levels the set was chosen with, not the levels
// shown since. A team kept only in memory still opens on the Teams page.
const save = (): void => {
  if (!shown.value) return
  if (library.teams.length >= MAX_SAVED_TEAMS) {
    error(i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS }))
    return
  }
  const name = i18n.t('app.sl-team-name', { chance: slPercent(shown.value.chance) })
  const team = library.saveAsNew('5v5', shown.value.data, name)
  if (!team) {
    error(i18n.t('app.team-unreadable'))
    return
  }
  if (!library.persisted) error(i18n.t('app.team-not-stored'))
  else success(i18n.t('app.team-saved', { name: team.name }))
  void router.push({ path: '/teams', state: { openTeam: team.id } })
}
</script>

<template>
  <main class="sl-page">
    <header class="sl-head">
      <h1>
        {{ i18n.t('app.sl-title')
        }}<button
          type="button"
          class="sl-beta"
          @mouseenter="betaOpen"
          @mouseleave="betaClose"
          @focus="betaOpen"
          @blur="betaClose"
          @click="betaToggle"
          @touchstart.passive="betaTouchStart"
        >
          BETA
        </button>
      </h1>
      <Teleport v-if="betaAnchor" to="body">
        <TooltipPopup :target-element="betaAnchor" variant="detailed" max-width="290px">
          <template #content>{{ i18n.t('app.sl-beta-tip') }}</template>
        </TooltipPopup>
      </Teleport>
      <p v-if="heading">
        {{ i18n.t('app.sl-records', { season: heading.season, date: heading.date }) }}
        <span aria-hidden="true">·</span>
        <button type="button" class="sl-about-link" @click="aboutOpen = true">
          {{ i18n.t('app.sl-about') }}
        </button>
      </p>
    </header>
    <SlAbout
      v-if="heading"
      :show="aboutOpen"
      :season="heading.season"
      :date="heading.date"
      :sample="heading.sample"
      :before="heading.before"
      @close="aboutOpen = false"
    />
    <p v-if="heading?.retired" class="sl-line sl-note">{{ i18n.t('app.sl-previous-season') }}</p>
    <p v-else-if="heading?.rotation" class="sl-line sl-note">
      {{ i18n.t('app.sl-previous-rotation') }}
    </p>
    <p v-if="failed" class="sl-line sl-note">{{ i18n.t('app.sl-load-failed') }}</p>

    <div v-if="mounted" ref="result" class="sl-result-slot">
      <SlResult v-if="shown" :shown @save="save" />
      <p v-else-if="noSet" class="sl-line">{{ i18n.t('app.sl-no-set') }}</p>
    </div>

    <section v-if="mounted" class="sl-picker">
      <SlBar :busy :ready="!!heading" @generate="generate" />
      <RosterEditor
        :heroes
        :levels="copy"
        :source-key="rosters.activeId"
        :armed-confirm
        hide-mechanics
        @edit="edit"
      />
    </section>
  </main>
</template>

<style scoped>
/* The page's buttons, and below its dock, a size above the Rosters tab's. */
.sl-page {
  --control-height-compact: var(--control-height);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  width: 100%;
  padding: 18px 24px 48px;
  border-radius: var(--section-radius);
}

.sl-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.sl-head h1 {
  margin: 0;
  font-size: 26px;
  line-height: 1.15;
  font-weight: 700;
  text-align: left;
  color: var(--color-text-primary);
}

/* A status label at the top of the title's line. */
.sl-beta {
  display: inline-flex;
  align-items: center;
  height: 18px;
  margin-left: 8px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--color-warning) 55%, transparent);
  border-radius: 9px;
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
  color: var(--color-warning);
  font-family: inherit;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1;
  vertical-align: top;
  cursor: help;
}

.sl-head p,
.sl-line {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.sl-about-link {
  margin-left: 0.35em;
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--color-primary);
  cursor: pointer;
}

.sl-about-link:hover {
  text-decoration: underline;
}

.sl-line.sl-note {
  color: var(--sl-bad);
}

.sl-result-slot {
  margin: 4px 0;
  scroll-margin-top: var(--spacing-lg);
}

.sl-result-slot:empty {
  display: none;
}

.sl-picker {
  --dock-scale: 1.4;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px 16px 16px;
  border: 1px solid var(--color-border-primary);
  border-radius: 14px;
  background: var(--color-bg-primary);
}

@media (max-width: 768px) {
  .sl-page {
    padding: 16px 16px 40px;
  }
  .sl-picker {
    padding: 12px;
  }
}

@media (max-width: 480px) {
  .sl-picker {
    --dock-scale: 1;
  }
}
</style>
