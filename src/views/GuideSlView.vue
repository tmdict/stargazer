<script setup lang="ts">
/* The Supreme League generator: for the heroes and levels a visitor picks,
   the set of five recorded teams, one per map and no hero twice, with the
   best chance to win a match (lib/pvp/sl), chosen in the Supreme League
   worker (useSlEngine) so the page stays responsive. The picker edits a copy
   of the active roster, so trying a hero out never changes the roster, and
   picking or importing another roster takes a fresh copy. The set is chosen only on
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
import { readTeamsSlot } from '@/composables/useGridPersistence'
import { useInfoTip } from '@/composables/useInfoTip'
import { useSlEngine } from '@/composables/useSlEngine'
import { useToast } from '@/composables/useToast'
import { ATTR_PARAGON, ATTR_REFINEMENT, type AttrRecord } from '@/lib/characters/attributes'
import { loadSlData } from '@/lib/pvp/sl/data/codec'
import type { SlData, SlSample } from '@/lib/pvp/sl/data/types'
import { TOP_LEVELS } from '@/lib/pvp/sl/generator/defaultSet'
import { choiceSeason, slTeamData } from '@/lib/pvp/sl/generator/team'
import type { SlPick } from '@/lib/pvp/sl/generator/types'
import { canonicalLevels } from '@/lib/rosters'
import { isRetiredSeason } from '@/lib/seasonal'
import { MAX_SAVED_TEAMS, TEAM_VARIANTS } from '@/lib/teams/modes'
import { holdsUnsavedWork } from '@/lib/teams/savedTeam'
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
const { error, success, show } = useToast()
const { status: engineStatus, generate: generateSet } = useSlEngine()

const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))

const {
  anchor: betaAnchor,
  hoverOpen: betaOpen,
  hoverClose: betaClose,
  toggle: betaToggle,
  onTouchStart: betaTouchStart,
} = useInfoTip()

// Plain, never reactive, so the decoded data stays out of anything the
// console can reach.
let data: SlData | null = null
const heading = ref<{
  season: number
  date: string
  rotation: boolean
  retired: boolean
  sample: SlSample
  before: (SlSample & { season: number }) | null
} | null>(null)
const aboutOpen = ref(false)
const failed = ref(false)
const mounted = ref(false)

// A load can fail after the page is left, when the route is another page's.
let active = true

onUnmounted(() => {
  active = false
})

onMounted(async () => {
  mounted.value = true
  try {
    data = await loadSlData()
  } catch {
    // A tab left open across a deploy asks for a file the deploy replaced, so
    // it reloads once. A browser that cannot decode the file never would.
    if (!active) return
    if (typeof DecompressionStream === 'undefined' || !reloadOntoCurrentBuild(route.fullPath)) {
      failed.value = true
    }
    return
  }
  heading.value = {
    season: data.season,
    date: data.exportedAt,
    rotation: data.maps.map((m) => m.key).join() !== TEAM_VARIANTS.sl.maps.join(),
    retired: isRetiredSeason(data.season),
    sample: data.sample,
    before: data.before ? { season: data.before.season, ...data.before.sample } : null,
  }
})

const sourceLevels = (id: number): AttrRecord | undefined =>
  rosters.active ? rosters.active.heroes[id] : TOP_LEVELS

const copy = ref<Record<string, AttrRecord>>({})
// Taken again when another roster becomes active, never on the roster object
// itself, which every library write replaces.
watch(
  () => rosters.activeId,
  () => {
    copy.value = rosters.active
      ? { ...rosters.active.heroes }
      : Object.fromEntries(heroes.value.map((c) => [c.id, TOP_LEVELS]))
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
  try {
    const picks = picksOf(copy.value)
    const set = await generateSet(picks)
    shown.value = set && {
      chance: set.chance,
      odds: set.odds,
      beforeUnder: file.before ? (file.beforeUnder ?? null) : null,
      teams: set.teams.map((t) => {
        const season = choiceSeason(file, t)
        const family = t.family === null ? null : season.families[t.family]!
        return {
          map: season.teams[t.team]!.map,
          group: family && { name: family.name, core: family.core },
          comp: t.comp,
          core: t.core,
          flex: t.flex,
          pairs: t.pairs,
          chance: t.chance,
        }
      }),
      data: slTeamData(file, set, picks),
    }
    noSet.value = !set
  } catch {
    // A file whose parts do not line up passes the shape check and fails in
    // the worker or here.
    shown.value = null
    failed.value = true
  } finally {
    busy.value = false
  }
  await nextTick()
  resultEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Save as team replaces the Teams page's 5v5 boards, so boards there holding
// work no saved team keeps take a second press.
const replacesWork = (): boolean => {
  const slot = readTeamsSlot('5v5')
  return slot !== null && holdsUnsavedWork(slot.data, library.get(slot.sourceId))
}
const saveArmed = computed(() => armedConfirm.armed.value === 'save-team')

// The saved team holds the levels the set was chosen with, not the levels
// shown since. A team kept only in memory still opens on the Teams page. A
// second press while that page loads saves nothing more.
let saving = false
const save = (): void => {
  if (!shown.value || saving) return
  const replacing = replacesWork()
  if (replacing && !armedConfirm.confirm('save-team')) {
    show(i18n.t('app.sl-save-replaces'), 'info')
    return
  }
  const name = i18n.t('app.sl-team-name', { chance: slPercent(shown.value.chance) })
  const team = library.saveAsNew('5v5', shown.value.data, name)
  if (!team) {
    // The library re-reads storage first, so another tab may have filled it.
    error(
      library.teams.length >= MAX_SAVED_TEAMS
        ? i18n.t('app.teams-limit', { max: MAX_SAVED_TEAMS })
        : i18n.t('app.team-unreadable'),
    )
    return
  }
  if (!library.persisted) error(i18n.t('app.team-not-stored'))
  else success(i18n.t(replacing ? 'app.sl-saved-replaced' : 'app.team-saved', { name: team.name }))
  saving = true
  void router.push({ path: '/teams', state: { openTeam: team.id } }).finally(() => {
    saving = false
  })
}
</script>

<template>
  <main class="sl-page" data-theme="dark">
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
    <p v-if="failed || engineStatus === 'failed'" class="sl-line sl-note">
      {{ i18n.t('app.sl-load-failed') }}
    </p>

    <div v-if="mounted" ref="result" class="sl-result-slot">
      <SlResult v-if="shown" :shown :save-armed @save="save" />
      <p v-else-if="noSet" class="sl-line">{{ i18n.t('app.sl-no-set') }}</p>
    </div>

    <section v-if="mounted" class="sl-picker">
      <SlBar
        :busy
        :ready="!!heading && engineStatus === 'ready'"
        :waiting="!failed && engineStatus === 'loading'"
        @generate="generate"
      />
      <RosterEditor
        :heroes
        :levels="copy"
        :source-key="rosters.activeId"
        :armed-confirm
        hide-mechanics
        large-dock
        @edit="edit"
      />
    </section>
  </main>
</template>

<style scoped>
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
  color: var(--color-danger-text);
}

.sl-result-slot {
  margin: 4px 0;
  line-height: 1.7;
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
  border: 1px solid var(--panel-edge);
  border-radius: var(--radius-large);
  background: var(--color-bg-primary);
}

@media (max-width: 768px) {
  .sl-page {
    padding: 16px 16px 40px;
  }
  .sl-picker {
    padding: 12px;
    border-color: transparent;
  }
}

@media (max-width: 480px) {
  .sl-picker {
    --dock-scale: 1;
  }
}
</style>
