<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import IconSearch from '@/components/ui/IconSearch.vue'
import { useRecentHeroes } from '@/composables/useRecentHeroes'
import { useScrollLock } from '@/composables/useScrollLock'
import { useSearchOverlay } from '@/composables/useSearchOverlay'
import { deepSearchMinLength, useSkillSearch, type SearchHit } from '@/composables/useSkillSearch'
import { isSkillLocale, SKILL_LOCALES, type SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { SPLIT_MIN_WIDTH } from '@/utils/breakpoints'
import {
  getSkillFile,
  getSkillLocaleDict,
  hasSkillLocale,
  loadCharacterImages,
  loadCharacters,
  loadIcons,
} from '@/utils/dataLoader'
import { renderRichText, type RichPiece, type Snippet } from '@/utils/searchHighlight'
import { curatedHeroName, slotLabel } from '@/utils/skillLabels'

// The pane's skill-text tokens are styled by content.css's unscoped rules.
import '@/styles/content.css'

const { isOpen, query, selectHandler, open, close } = useSearchOverlay()
const i18n = useI18nStore()
const route = useRoute()
const router = useRouter()
const { recentHeroes } = useRecentHeroes()

// Teleport only after mount: the SSG pass and hydration both render nothing.
const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})

// The detail pane rides the site's two-column stack point; the row model
// changes with it (one row per hero instead of per hit), so this must be
// reactive state, not just CSS.
const isWide = ref(false)
let wideMq: MediaQueryList | null = null
const onWideChange = (e: MediaQueryListEvent) => (isWide.value = e.matches)
onMounted(() => {
  wideMq = window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`)
  isWide.value = wideMq.matches
  wideMq.addEventListener('change', onWideChange)
})
onUnmounted(() => wideMq?.removeEventListener('change', onWideChange))

// Select mode: a trigger opened the overlay to pick a hero (the arena roster);
// activating a row hands the slug to the opener instead of navigating.
const selectMode = computed(() => selectHandler.value !== null)

const debounced = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(query, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => (debounced.value = q), 150)
})
onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const appLang = computed(() => i18n.currentLocale)
// Reading language: the page's URL prefix on skill routes, else the pref.
const textLang = computed<SkillLocale>(() => {
  const p = route.params.textLocale
  return typeof p === 'string' && isSkillLocale(p) ? p : i18n.effectiveSkillLocale
})

const results = useSkillSearch(debounced, appLang, textLang)

const trimmedQuery = computed(() => debounced.value.trim())
const queryActive = computed(() => trimmedQuery.value.length > 0)

function heroName(slug: string): string {
  return curatedHeroName(slug, appLang.value)
}

function heroBadges(slug: string): string[] {
  const character = loadCharacters().find((c) => c.name === slug)
  if (!character) return []
  const icons = loadIcons()
  return [icons[`faction-${character.faction}`], icons[`class-${character.class}`]].filter(
    (icon): icon is string => Boolean(icon),
  )
}

// One row per hit; the first row of a hero group carries the portrait and
// the rest indent under it (grouped, always expanded).
interface OverlayRow {
  key: string
  slug: string
  href: string
  /** Language of the hit's text, for the snippet's lang attribute. */
  lang: SkillLocale
  portrait: boolean
  alt: string
  hit?: SearchHit
  chip: string
  nameText?: string
}

const hitRows = computed<OverlayRow[]>(() => {
  const rs = results.value
  if (!rs) return []
  return rs.flatMap((r) =>
    r.hits.map((hit, i) => ({
      key: `${r.slug}:${hit.slot ?? 'name'}:${i}`,
      slug: r.slug,
      href: `/${hit.locale}/skill/${r.slug}${hit.slot ? `#${hit.slot}` : ''}`,
      lang: hit.locale,
      portrait: i === 0,
      alt: heroName(r.slug),
      hit,
      chip: hit.slot ? slotLabel(hit.slot, appLang.value) : '',
    })),
  )
})

const recentRows = computed<OverlayRow[]>(() =>
  recentHeroes.value
    .filter((slug) => hasSkillLocale(slug))
    .map((slug) => ({
      key: `recent:${slug}`,
      slug,
      href: `/${textLang.value}/skill/${slug}`,
      lang: textLang.value,
      portrait: true,
      alt: heroName(slug),
      chip: '',
      nameText: heroName(slug),
    })),
)

// Wide mode collapses the list to one portrait + name row per hero; the pane
// carries the hit text, so nothing is hidden.
const heroRows = computed<OverlayRow[]>(() => {
  const rs = results.value
  if (!rs) return []
  return rs.flatMap((r) => {
    const hit = r.hits[0]
    if (!hit) return []
    return [
      {
        key: `hero:${r.slug}`,
        slug: r.slug,
        href: `/${hit.locale}/skill/${r.slug}${hit.slot ? `#${hit.slot}` : ''}`,
        lang: hit.locale,
        portrait: true,
        alt: heroName(r.slug),
        chip: '',
        nameText: heroName(r.slug),
      },
    ]
  })
})

const paneVisible = computed(
  () => isWide.value && queryActive.value && (results.value?.length ?? 0) > 0,
)

const rows = computed(() => {
  if (!queryActive.value) return recentRows.value
  return paneVisible.value ? heroRows.value : hitRows.value
})

const selected = ref(0)
const paneHitIndex = ref(0)
const listRef = ref<HTMLElement | null>(null)

// Reset on a new query; merely clamp when rows shift underneath (locale
// chunks streaming in re-run the open query, and arrowing through results
// shouldn't snap back to the top on every chunk).
watch(debounced, () => {
  selected.value = 0
})
watch(rows, (r) => {
  if (selected.value >= r.length) selected.value = 0
})
watch(selected, () => {
  paneHitIndex.value = 0
})

// ---------- detail pane (≥1220px) ----------

interface PaneHit {
  key: string
  href: string
  /** Language of this hit's title and body text. */
  lang: SkillLocale
  /** Highlighted title for hits whose match IS a name (hero or skill name);
   * description hits are titled by typeLine instead. */
  title: Snippet | null
  /** Chrome-language slot + level heading, e.g. "Ultimate · LV 2". */
  typeLine: string
  /** Matched text in full, token-styled; d[0] as context for skill-name hits. */
  body: RichPiece[] | null
}

const paneHero = computed(() =>
  paneVisible.value ? (results.value?.[selected.value] ?? null) : null,
)

const paneHits = computed<PaneHit[]>(() => {
  const hero = paneHero.value
  if (!hero) return []
  const q = trimmedQuery.value
  return hero.hits.map((hit, i) => {
    const slot = hit.slot
    // Per hit, not per hero: slot dedup spans the locale loop, so a hero's
    // hits can come from different languages.
    const slotData = slot ? getSkillFile(hit.locale, hero.slug)?.[slot] : undefined
    let typeLine = ''
    if (slot) {
      const label = slotLabel(slot, appLang.value)
      typeLine =
        hit.tier != null
          ? `${label} · REFINE ${hit.tier}`
          : hit.level
            ? `${label} · LV ${hit.level}`
            : label
    }
    let bodyText: string | null = null
    if (slotData) {
      if (hit.loc === 'description') {
        bodyText =
          hit.tier != null
            ? (slotData.r?.find((r) => r.t === hit.tier)?.d ?? null)
            : (slotData.d[(hit.level ?? 1) - 1] ?? null)
      } else if (hit.loc === 'skill-name') {
        bodyText = slotData.d[0] ?? null
      }
    }
    return {
      key: `${hero.slug}:${slot ?? 'name'}:${i}`,
      href: `/${hit.locale}/skill/${hero.slug}${slot ? `#${slot}` : ''}`,
      lang: hit.locale,
      title: hit.loc === 'description' ? null : hit.snippet,
      typeLine,
      body: bodyText ? renderRichText(bodyText, q) : null,
    }
  })
})

const paneBadges = computed(() => (paneHero.value ? heroBadges(paneHero.value.slug) : []))

// Below the deep-search threshold only hero names match; say so instead of
// looking mysteriously thin.
const shortQuery = computed(
  () => queryActive.value && trimmedQuery.value.length < deepSearchMinLength(trimmedQuery.value),
)

const heroCount = computed(() => results.value?.length ?? 0)
const countsText = computed(() =>
  i18n.t('app.search-count', { heroes: heroCount.value, hits: hitRows.value.length }),
)

// The first query streams the missing locale chunks in; surface the progress
// quietly. Failed chunks keep the note up: those languages are not being
// searched until the next query retries them.
const warmLocales = computed(
  () => SKILL_LOCALES.filter(({ code }) => getSkillLocaleDict(code) !== null).length,
)
const streaming = computed(() => queryActive.value && warmLocales.value < SKILL_LOCALES.length)
const streamingText = computed(() =>
  i18n.t('app.search-streaming', { n: warmLocales.value, total: SKILL_LOCALES.length }),
)

// ---------- selection + navigation ----------

function scrollSelectedIntoView(): void {
  void nextTick(() => {
    listRef.value
      ?.querySelector(`[data-index="${selected.value}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

// New-tab always opens the skill page, select mode included; otherwise
// select mode hands the slug to the opener and navigate mode routes.
function activate(slug: string, href: string, newTab: boolean): void {
  if (newTab) {
    window.open(router.resolve(href).href, '_blank', 'noopener')
    return
  }
  const select = selectHandler.value
  close()
  if (select) select(slug)
  else void router.push(href)
}

function onInputKeydown(e: KeyboardEvent): void {
  // IME composition keys (Enter commits, arrows pick candidates) must not
  // drive the list; keyCode 229 covers browsers that omit isComposing.
  if (e.isComposing || e.keyCode === 229) return
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = rows.value.length
    if (n === 0) return
    selected.value = (selected.value + (e.key === 'ArrowDown' ? 1 : n - 1)) % n
    scrollSelectedIntoView()
  } else if (e.key === 'Tab') {
    // Focus stays on the input (selection is aria-activedescendant-driven and
    // every other control is Escape- or arrow-reachable), so Tab never walks
    // out of the modal; with the pane open it cycles the hero's hits instead.
    e.preventDefault()
    if (paneVisible.value) {
      const n = paneHits.value.length
      if (n > 1) paneHitIndex.value = (paneHitIndex.value + (e.shiftKey ? n - 1 : 1)) % n
    }
  } else if (e.key === 'Enter') {
    const row = rows.value[selected.value]
    if (!row) return
    const href = paneVisible.value
      ? (paneHits.value[paneHitIndex.value]?.href ?? row.href)
      : row.href
    activate(row.slug, href, e.metaKey || e.ctrlKey)
  }
}

// ---------- open/close plumbing ----------

const inputRef = ref<HTMLInputElement | null>(null)

useScrollLock(isOpen)

// The overlay is the topmost layer (the shortcut can open it above SkillModal),
// Escape is handled in capture phase and stopped before any other listener,
// document-level ones included: one press closes only the overlay, never
// what sits beneath.
const onCaptureKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || !isOpen.value || e.isComposing || e.keyCode === 229) return
  e.stopImmediatePropagation()
  close()
}
onMounted(() => document.addEventListener('keydown', onCaptureKeydown, { capture: true }))
onUnmounted(() => document.removeEventListener('keydown', onCaptureKeydown, { capture: true }))

// Clicks never leave the overlay: document-level click-outside listeners on
// surfaces beneath (BaseModal's useOverlay) would otherwise treat a click on
// this body-teleported layer as "outside" and close themselves. The backdrop
// itself closes only the overlay.
const onBackdropClick = (e: MouseEvent) => {
  e.stopPropagation()
  if (e.target === e.currentTarget) close()
}

// Navigations the overlay did not cause (back/forward) close it; leaving it
// open would keep a select-mode handler live on a page it no longer belongs
// to. Own navigations already closed via activate().
watch(
  () => route.fullPath,
  () => {
    if (isOpen.value) close()
  },
)

// Focus moves into the input on open (query pre-selected so typing replaces
// it) and returns to whatever opened the overlay on close.
let opener: HTMLElement | null = null
watch(isOpen, (open) => {
  if (open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => {
      inputRef.value?.focus()
      inputRef.value?.select()
    })
  } else {
    opener?.focus()
    opener = null
  }
})

// Keyboard entry is always the navigate flavor: open() resets any select
// handler a trigger may have installed on a previous open.
const onGlobalKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (isOpen.value) close()
    else open()
    return
  }
  // Bare `/` only: not while typing elsewhere, and not as part of a browser
  // chord (Ctrl+/ or ⌘+/).
  if (e.key === '/' && !isOpen.value && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const t = e.target
    const typing =
      t instanceof HTMLElement &&
      (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    if (!typing) {
      e.preventDefault()
      open()
    }
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <Teleport v-if="mounted" to="body">
    <Transition name="sso">
      <div v-if="isOpen" class="sso-backdrop" :lang="i18n.currentLocale" @click="onBackdropClick">
        <div
          class="sso-panel"
          :class="{ wide: paneVisible }"
          role="dialog"
          aria-modal="true"
          :aria-label="i18n.t('app.skill-search-placeholder')"
        >
          <div class="sso-input-row">
            <IconSearch :size="18" class="sso-icon" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              class="sso-input"
              role="combobox"
              aria-autocomplete="list"
              :aria-expanded="rows.length > 0"
              aria-controls="sso-list"
              :aria-activedescendant="rows.length ? `sso-opt-${selected}` : undefined"
              :placeholder="i18n.t('app.skill-search-placeholder')"
              autocomplete="off"
              spellcheck="false"
              @keydown="onInputKeydown"
            />
            <button type="button" class="sso-cancel" tabindex="-1" @click="close">
              {{ i18n.t('app.search-cancel') }}
            </button>
          </div>

          <div v-if="queryActive" class="sso-sect">
            <span>
              {{ i18n.t(shortQuery ? 'app.search-hero-names' : 'app.search-best-matches') }}
              <template v-if="rows.length"> · {{ countsText }}</template>
            </span>
            <span v-if="streaming" class="sso-stream">{{ streamingText }}</span>
          </div>
          <div v-else-if="rows.length" class="sso-sect">
            <span>{{ i18n.t('app.search-recent') }}</span>
          </div>

          <div class="sso-body">
            <!-- Listbox role only while options exist: the no-results block
                 renders in this container, and a listbox may hold only options. -->
            <div
              id="sso-list"
              ref="listRef"
              class="sso-list"
              :class="{ side: paneVisible }"
              :role="rows.length ? 'listbox' : undefined"
              :aria-label="i18n.t('app.skill-search-placeholder')"
            >
              <a
                v-for="(row, i) in rows"
                :id="`sso-opt-${i}`"
                :key="row.key"
                :href="row.href"
                class="sso-row"
                :class="{ sel: i === selected }"
                role="option"
                :aria-selected="i === selected"
                :data-index="i"
                tabindex="-1"
                @click.prevent="activate(row.slug, row.href, $event.metaKey || $event.ctrlKey)"
                @mousemove="selected = i"
              >
                <img
                  v-if="row.portrait"
                  :src="loadCharacterImages()[row.slug]"
                  :alt="row.alt"
                  class="sso-portrait"
                />
                <span v-else class="sso-indent" aria-hidden="true"></span>
                <span v-if="row.nameText" class="sso-snip">{{ row.nameText }}</span>
                <span
                  v-else-if="row.hit"
                  class="sso-snip"
                  :class="{ 'sso-skill': row.hit.loc === 'skill-name' }"
                  :lang="row.lang"
                  >{{ row.hit.snippet.pre }}<mark>{{ row.hit.snippet.match }}</mark
                  >{{ row.hit.snippet.post }}</span
                >
                <span v-if="row.chip" class="sso-chip">{{ row.chip }}</span>
              </a>

              <div
                v-if="queryActive && !shortQuery && results && rows.length === 0"
                class="sso-nores"
              >
                {{ i18n.t('app.skill-no-matches', { query: `"${trimmedQuery}"` }) }}
                <span class="sso-hints">{{ i18n.t('app.search-no-matches-hint') }}</span>
              </div>
            </div>

            <div v-if="paneVisible" class="sso-pane">
              <div v-if="paneBadges.length" class="sso-pane-meta">
                <img
                  v-for="(badge, bi) in paneBadges"
                  :key="bi"
                  class="sso-pane-badge"
                  :src="badge"
                  alt=""
                />
              </div>
              <template v-for="(paneHit, hi) in paneHits" :key="paneHit.key">
                <div v-if="hi > 0" class="sso-pane-div"></div>
                <a
                  :href="paneHit.href"
                  class="sso-pane-hit"
                  :class="{ on: hi === paneHitIndex }"
                  tabindex="-1"
                  @click.prevent="
                    paneHero &&
                    activate(paneHero.slug, paneHit.href, $event.metaKey || $event.ctrlKey)
                  "
                  @mousemove="paneHitIndex = hi"
                >
                  <span v-if="paneHit.title" class="sso-pane-title" :lang="paneHit.lang"
                    >{{ paneHit.title.pre }}<mark>{{ paneHit.title.match }}</mark
                    >{{ paneHit.title.post }}</span
                  >
                  <!-- Chrome-language slot label heading content-language text. -->
                  <span v-else class="sso-pane-title" :lang="i18n.currentLocale">{{
                    paneHit.typeLine
                  }}</span>
                  <p v-if="paneHit.body" class="sso-pane-desc" :lang="paneHit.lang">
                    <template v-for="(piece, pi) in paneHit.body" :key="pi">
                      <span
                        v-if="piece.kind === 'stat'"
                        :class="['skill-stat-tag', `skill-stat-${piece.tag}`]"
                        >{{ piece.text }}</span
                      >
                      <mark v-else-if="piece.marked">{{ piece.text }}</mark>
                      <span v-else-if="piece.kind === 'value'" class="skill-highlight">{{
                        piece.text
                      }}</span>
                      <template v-else>{{ piece.text }}</template>
                    </template>
                  </p>
                </a>
              </template>
            </div>
          </div>

          <div v-if="shortQuery" class="sso-note">{{ i18n.t('app.search-min-chars') }}</div>
          <div v-if="!queryActive" class="sso-tip">{{ i18n.t('app.search-tip') }}</div>

          <div class="sso-foot">
            <span><kbd>↑</kbd><kbd>↓</kbd> {{ i18n.t('app.search-navigate') }}</span>
            <span v-if="paneVisible"><kbd>⇥</kbd> {{ i18n.t('app.search-cycle') }}</span>
            <span
              ><kbd>↵</kbd> {{ i18n.t(selectMode ? 'app.search-select' : 'app.search-open') }}</span
            >
            <span><kbd>esc</kbd> {{ i18n.t('app.search-close') }}</span>
          </div>

          <span class="sr-only" aria-live="polite">{{ queryActive ? countsText : '' }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sso-backdrop {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
  background: rgba(24, 26, 31, 0.55);
  font-family: Verdana, Arial, 'Microsoft YaHei', sans-serif;
}

.sso-panel {
  display: flex;
  flex-direction: column;
  width: min(640px, 94vw);
  max-height: min(72vh, 640px);
  background: #23262c;
  border: 1px solid #3a3e46;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
}

.sso-panel.wide {
  width: min(820px, 94vw);
}

.sso-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.sso-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid #33373f;
}

.sso-icon {
  flex-shrink: 0;
  color: #8a8f98;
}

.sso-input {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 1rem;
  color: #fff;
  background: none;
  border: none;
  caret-color: var(--color-accent);
}

.sso-input:focus {
  outline: none;
}

.sso-input::placeholder {
  color: #8a8f98;
}

.sso-cancel {
  display: none;
  font: inherit;
  font-size: 0.9rem;
  color: var(--color-accent);
  background: none;
  border: none;
  cursor: pointer;
}

.sso-sect {
  display: flex;
  align-items: baseline;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #6b7079;
  padding: 10px 14px 4px;
}

.sso-stream {
  margin-left: auto;
  font-weight: 400;
  letter-spacing: 0.02em;
  text-transform: none;
  font-size: 0.66rem;
  color: #565b63;
}

.sso-list {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 4px;
}

/* Subtle thin scrollbars instead of the default high-contrast ones (same
   treatment as the locale menu panel). */
.sso-list,
.sso-pane {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.sso-list::-webkit-scrollbar,
.sso-pane::-webkit-scrollbar {
  width: 6px;
}

.sso-list::-webkit-scrollbar-thumb,
.sso-pane::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.sso-list::-webkit-scrollbar-track,
.sso-pane::-webkit-scrollbar-track {
  background: transparent;
}

.sso-list.side {
  flex: 0 0 200px;
  border-right: 1px solid #33373f;
}

/* ---------- detail pane (≥1220px) ---------- */

.sso-pane {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 14px 16px;
}

.sso-pane-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.sso-pane-badge {
  width: 21px;
  height: 21px;
  border-radius: 50%;
  border: 1px solid #4a4f58;
}

.sso-pane-hit {
  display: block;
  padding-left: 10px;
  border-left: 2px solid transparent;
  text-decoration: none;
  cursor: pointer;
}

.sso-pane-hit.on {
  border-left-color: var(--color-accent);
}

.sso-pane-title {
  color: var(--color-accent);
  font-weight: 700;
  font-size: 0.9rem;
}

.sso-pane-desc {
  margin: 4px 0 2px;
  color: #b8bdc6;
  font-size: 0.8rem;
  line-height: 1.6;
}

.sso-pane-title mark,
.sso-pane-desc mark {
  background: none;
  color: #f2c94c;
  font-weight: 700;
}

.sso-pane-div {
  height: 1px;
  margin: 8px 0;
  background: linear-gradient(to right, transparent, #4a4f58, transparent);
}

.sso-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 9px 14px;
  cursor: pointer;
  text-decoration: none;
}

.sso-row:hover {
  background: #2c3037;
}

.sso-row.sel {
  background: var(--color-accent-active);
}

.sso-portrait {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  object-fit: cover;
  object-position: center 15%;
  flex-shrink: 0;
}

.sso-indent {
  width: 38px;
  flex-shrink: 0;
}

.sso-snip {
  flex: 1;
  min-width: 0;
  font-size: 0.86rem;
  color: #c6cad2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sso-skill {
  color: var(--color-accent);
  font-weight: 700;
}

.sso-snip mark {
  background: none;
  color: var(--color-accent);
  font-weight: 700;
}

.sso-row.sel .sso-snip {
  color: #fff;
}

.sso-row.sel .sso-snip mark {
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.sso-chip {
  flex-shrink: 0;
  font-size: 0.63rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #b8bdc6;
  background: #33373f;
  padding: 2px 8px;
  border-radius: 999px;
}

.sso-row.sel .sso-chip {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.sso-nores {
  padding: 24px 16px 10px;
  text-align: center;
  color: #9aa0a8;
  font-size: 0.88rem;
}

.sso-hints {
  display: block;
  margin-top: 7px;
  font-size: 0.76rem;
  color: #6b7079;
  line-height: 1.6;
}

.sso-note {
  padding: 8px 14px 4px;
  font-size: 0.76rem;
  color: #8a8f98;
}

.sso-tip {
  padding: 10px 14px 12px;
  font-size: 0.74rem;
  color: #8a8f98;
  border-top: 1px solid #33373f;
}

.sso-foot {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  padding: 8px 14px;
  border-top: 1px solid #33373f;
  font-size: 0.68rem;
  color: #6b7079;
}

/* system-ui rather than the content font: Verdana lacks ↵ and ⇥, so those
   chips would fall back to a font with different metrics than ↑ ↓; one
   family gives every glyph the same box and baseline. */
.sso-foot kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  line-height: 1;
  font-family: system-ui, sans-serif;
  font-size: 0.72rem;
  background: #2c3037;
  border: 1px solid #3f444d;
  border-radius: 4px;
  margin-right: 4px;
  color: #9aa0a8;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

/* open/close motion; opacity-only under reduced motion */
.sso-enter-active {
  transition: opacity 0.15s ease;
}
.sso-enter-active .sso-panel {
  transition:
    transform 0.12s ease-out,
    opacity 0.12s ease-out;
}
.sso-leave-active {
  transition: opacity 0.08s ease;
}
.sso-enter-from,
.sso-leave-to {
  opacity: 0;
}
.sso-enter-from .sso-panel {
  transform: scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .sso-enter-active .sso-panel {
    transition: none;
  }
  .sso-enter-from .sso-panel {
    transform: none;
  }
}

/* Mobile: the overlay becomes a full-screen layer. */
@media (max-width: 768px) {
  .sso-backdrop {
    padding-top: 0;
  }
  .sso-panel {
    width: 100%;
    max-height: none;
    height: 100dvh;
    border: none;
    border-radius: 0;
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sso-cancel {
    display: block;
  }
  .sso-row {
    padding: 12px 14px;
  }
  .sso-portrait,
  .sso-indent {
    width: 42px;
  }
  .sso-portrait {
    height: 42px;
  }
  /* Matched text outranks the slot label when row width is scarce. */
  .sso-chip {
    display: none;
  }
  .sso-foot {
    display: none;
  }
}
</style>
