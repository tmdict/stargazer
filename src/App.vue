<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import DragPreview from '@/components/DragPreview.vue'
import AboutModal from '@/components/modals/AboutModal.vue'
import InspectModals from '@/components/modals/InspectModals.vue'
import HeaderSearchTrigger from '@/components/search/HeaderSearchTrigger.vue'
import SkillSearchOverlay from '@/components/search/SkillSearchOverlay.vue'
import ContactForm from '@/components/ui/ContactForm.vue'
import IconGitHub from '@/components/ui/IconGitHub.vue'
import IconHelp from '@/components/ui/IconHelp.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import IconMail from '@/components/ui/IconMail.vue'
import IconSearch from '@/components/ui/IconSearch.vue'
import LocaleMenu from '@/components/ui/LocaleMenu.vue'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import rowanGif from '@/assets/rowan.gif'
import rowanSvg from '@/assets/rowan.svg'
import { useLocaleSwitch } from '@/composables/useLocaleSwitch'
import { useSearchOverlay } from '@/composables/useSearchOverlay'
import { useSeasonNotice } from '@/composables/useSeasonNotice'
import { useLiftGuard } from '@/composables/useSelectionState'
import { helpPath } from '@/lib/help'
import { APP_LOCALES } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { loadSkillLocale } from '@/utils/dataLoader'
import { splitLocalePath } from '@/utils/routeLocale'
import { runSeasonRotationPass } from '@/utils/seasonRotation'
import {
  runModeStoragePass,
  runUpgradeStoragePass,
  runVersionStoragePass,
} from '@/utils/upgradeMigration'

const isLogoHovered = ref(false)
const showAboutModal = ref(false)
const contactOpen = ref(false)
const contactButton = ref<HTMLElement | null>(null)
const i18n = useI18nStore()
const route = useRoute()
const router = useRouter()
const { target: localeTarget, pick: pickLocale } = useLocaleSwitch()
const { open: openSearch } = useSearchOverlay()
useLiftGuard()

// Header renders on every route; init here so SSG-only routes whose views
// don't call initialize (about, skill/*) still get translations. Idempotent.
i18n.initialize()

// TEMPORARY (delete with upgradeMigration.ts). Root setup runs before any
// route child's persistence reads, and on every entry page, so stored boards
// convert even for visitors who never open /teams. The u-pass runs first so a
// device that skipped a release converts the retired slot's rows before the
// mode pass moves it; the v pass runs last so it strips `v` from whatever
// they wrote.
runUpgradeStoragePass()
runModeStoragePass()
runVersionStoragePass()

// Permanent: root setup runs before any route child's persistence reads, and
// the arena autosave must re-align once per season flip before its page can
// read it.
const strippedSeason = runSeasonRotationPass()
if (strippedSeason !== null) useSeasonNotice().notify(strippedSeason)

// Locale-prefixed routes are authoritative: keep the store in sync with the
// path so the header and skill browser render in the URL's language (during
// SSG and client navigation alike). URL-derived locale is display-only:
// following a shared /zh/... link must not overwrite the saved preference
// (only the language menu and ?l= persist).
watch(
  () => route.path,
  (path) => {
    const { locale } = splitLocalePath(path)
    if (locale) i18n.setLocale(locale, { persist: false })
  },
  { immediate: true },
)

// About links to Help; the popup must not stay open over the page it opened.
watch(
  () => route.path,
  () => (showAboutModal.value = false),
)

// No skill text ships with the app, so the reader's language is fetched in
// the background and the first skill popup or text search finds it warm. It
// waits for the first route: until then the path has not pinned the locale,
// and a /zh/ page would fetch English. A skill page has loaded the language
// it shows and needs no other. A failed fetch is left to the surface that
// needs the text, which reports it.
const routeSettled = ref(false)
watch(
  () => (routeSettled.value && route.name !== 'skill' ? i18n.effectiveSkillLocale : null),
  (lang) => {
    if (lang) void loadSkillLocale(lang).catch(() => {})
  },
)

// The unprefixed shells (/, /skills, …) are pre-rendered in English; applying
// the saved locale only after mount keeps hydration matched to the baked HTML
// (the post-mount swap updates text and link hrefs alike). Prefixed routes are
// language-pinned by the path via the watcher above.
onMounted(() => {
  i18n.initializeSkillLocale()
  if (!splitLocalePath(window.location.pathname).locale) {
    i18n.initializeLocale()
  }
  void router.isReady().then(() => (routeSettled.value = true))
})

// Keyboard shortcut handler
const handleKeyDown = (e: KeyboardEvent) => {
  // Alt+L (Option+L on macOS) steps to the next language in menu order. Match
  // the physical key via `code`: macOS composes a different `key` value when
  // Option is held.
  if (e.altKey && e.code === 'KeyL') {
    e.preventDefault()
    const next = APP_LOCALES.indexOf(i18n.currentLocale) + 1
    pickLocale(APP_LOCALES[next % APP_LOCALES.length]!)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <header>
    <nav>
      <RouterLink
        to="/"
        class="logo-link"
        @mouseenter="isLogoHovered = true"
        @mouseleave="isLogoHovered = false"
      >
        <img alt="logo" class="logo" :src="isLogoHovered ? rowanGif : rowanSvg" />
      </RouterLink>

      <HeaderSearchTrigger class="nav-search" />

      <div class="nav-tabs">
        <RouterLink to="/" class="nav-text-link" :class="{ active: route.path === '/' }">{{
          i18n.t('app.arena')
        }}</RouterLink>
        <RouterLink
          to="/teams"
          class="nav-text-link"
          :class="{ active: route.path === '/teams' }"
          >{{ i18n.t('app.teams') }}</RouterLink
        >
        <RouterLink
          to="/skills"
          class="nav-text-link"
          :class="{ active: route.path === '/skills' }"
          >{{ i18n.t('app.skills') }}</RouterLink
        >
        <RouterLink
          :to="`/${i18n.currentLocale}/guide`"
          class="nav-text-link"
          :class="{ active: route.path.includes('/guide') }"
          >{{ i18n.t('app.guide') }}</RouterLink
        >
      </div>
      <ul class="menu">
        <li class="menu-search">
          <button
            type="button"
            class="icon-link icon-button"
            aria-haspopup="dialog"
            :aria-label="i18n.t('app.skill-search-placeholder')"
            :title="i18n.t('app.skill-search-placeholder')"
            @click="openSearch"
          >
            <IconSearch :size="22" />
          </button>
        </li>
        <li>
          <button
            @click="showAboutModal = true"
            class="icon-link icon-button"
            :title="i18n.t('app.about')"
          >
            <IconInfo />
          </button>
        </li>
        <li>
          <RouterLink
            :to="helpPath(i18n.currentLocale)"
            class="icon-link"
            :title="i18n.t('app.help')"
            :aria-label="i18n.t('app.help')"
          >
            <IconHelp aria-hidden="true" />
          </RouterLink>
        </li>
        <li>
          <a
            href="https://github.com/tmdict/stargazer/"
            class="icon-link"
            :title="i18n.t('app.code')"
            :aria-label="i18n.t('app.code')"
          >
            <IconGitHub aria-hidden="true" />
          </a>
        </li>
        <li>
          <button
            ref="contactButton"
            type="button"
            class="icon-link icon-button"
            :title="i18n.t('app.contact')"
            :aria-label="i18n.t('app.contact')"
            :aria-expanded="contactOpen"
            @click="contactOpen = !contactOpen"
          >
            <IconMail />
          </button>
        </li>
        <li class="menu-locale">
          <LocaleMenu
            :current="i18n.currentLocale"
            :link-to="localeTarget"
            @select="i18n.setLocale"
          />
        </li>
      </ul>
    </nav>
  </header>

  <RouterView />

  <!-- Global drag preview -->
  <DragPreview />

  <!-- About modal -->
  <AboutModal :show="showAboutModal" @close="showAboutModal = false" />

  <ContactForm v-model:open="contactOpen" :trigger="contactButton" />

  <ToastContainer />

  <!-- Global skill search overlay; renders nothing until opened -->
  <SkillSearchOverlay />

  <!-- Inspect detail modals (useInspect); render nothing until first used -->
  <InspectModals />
</template>

<style scoped>
header {
  background-color: #282c34;
  border-bottom: 3px solid #f7d87c;
  padding: 0.5rem 0;
}

nav {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  row-gap: 0.4rem;
  max-width: none;
  margin: 0;
  padding: 0 2.5em 0 2em;
}

nav ul {
  margin-bottom: 0;
}

nav ul li {
  margin-bottom: 0;
}

.logo-link {
  display: inline-block;
  line-height: 0;
}

.logo {
  height: 70px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.logo:hover {
  transform: scale(1.25);
}

/* Utility icons (language, source, about). */
.menu {
  display: flex;
  list-style: none;
  align-items: center;
  gap: 1.5rem;
  margin-left: 1.5rem;
}

.menu a,
.menu button,
.menu-locale {
  color: #ddd;
  text-decoration: none;
  font-weight: 600;
  border-radius: 6px;
}

.menu a,
.menu button {
  font-size: 1.1rem;
}

.menu a:hover,
.menu button:hover,
.menu-locale:hover {
  color: #f7d87c;
}

/* Wide headers: the search pill leads the right-side cluster and its auto
   margin is the push off the logo. Below 921px the full pill overflows the
   bar (natural width ~836px), so search swaps to the .menu-search icon in
   the utility cluster and the push returns to the tab row. */
.nav-search {
  margin-left: auto;
}

/* Section tabs; sit at the right ahead of the icons on desktop. */
.nav-tabs {
  display: flex;
  align-items: flex-end;
  gap: 1.5rem;
  margin-left: 1.5rem;
}

@media (max-width: 920px) {
  .nav-search {
    display: none;
  }

  .nav-tabs {
    margin-left: auto;
  }
}

@media (min-width: 921px) {
  .menu-search {
    display: none;
  }
}

/* The magnifier's handle hangs bottom-right, so box-centering leaves the
   circle — what the eye reads — ~1px above its siblings; nudge to optically
   align. */
.menu-search svg {
  transform: translateY(1px);
}

.nav-text-link {
  font-size: 0.85rem;
  font-weight: 600;
  color: #ddd;
  text-decoration: none;
  letter-spacing: 0.05em;
  padding: 4px 10px;
  margin-bottom: 0.2rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
}

.nav-text-link:hover {
  color: #f7d87c;
  background: rgba(255, 255, 255, 0.18);
}

.nav-text-link.active {
  color: #f7d87c;
}

.icon-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s ease;
}

/* Mobile: two rows (logo + icons on top, a full-width segmented tab strip
   below) instead of cramming everything into one shrunken row. The icons
   (order 1) stay on the logo row; the tabs (order 2, full-width) wrap beneath. */
@media (max-width: 768px) {
  nav {
    align-items: center;
    padding: 0.4rem 1rem 0;
    row-gap: 0.5rem;
  }

  .logo {
    height: 50px;
  }

  .menu {
    order: 1;
    margin-left: auto;
    gap: 1rem;
  }

  /* This row centers vertically: neutralize base.css's prose li metrics
     (4px top margin + a 1.6 line-height strut), which otherwise sink the
     icons a few px below the row's center. */
  .menu li {
    margin: 0;
    display: flex;
  }

  .nav-tabs {
    order: 2;
    flex-basis: 100%;
    margin-left: 0;
    gap: 0.5rem;
    padding-bottom: 0.3rem;
  }

  .nav-text-link {
    flex: 1;
    text-align: center;
    font-size: 0.8rem;
    padding: 6px 8px;
    margin-bottom: 0;
    white-space: nowrap;
    background: rgba(255, 255, 255, 0.08);
  }

  .nav-text-link.active {
    background: rgba(247, 216, 124, 0.18);
  }
}

@media (max-width: 480px) {
  header {
    padding: 0.25rem 0;
  }

  nav {
    padding: 0.4rem 0.75rem 0;
  }

  .logo {
    height: 48px;
  }

  .logo:hover {
    transform: scale(1.1);
  }

  .menu {
    gap: 0.8rem;
  }

  .menu a,
  .menu button {
    font-size: 1rem;
  }

  .nav-text-link {
    font-size: 0.72rem;
    padding: 6px 4px;
    letter-spacing: 0.02em;
  }
}
</style>
