<script setup lang="ts">
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import HelpBoard from '@/components/help/HelpBoard.vue'
import HelpToggle from '@/components/help/HelpToggle.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { appLabel } from '@/utils/skillLabels'

defineProps<{
  kind: 'add' | 'skills' | 'move' | 'remove' | 'target' | 'share'
  // The skills window's text, from the content file so it is in the page's
  // language. `hero` is the portrait slug.
  skill?: { hero: string; heroName: string; title: string; meta: string; text: string }
}>()

const lang = useRouteLocale()
const label = (key: string): string => appLabel(key, lang.value)

const POPUP_HEROES = ['frieren', 'alna', 'rhys', 'gerda', 'thoran']
</script>

<template>
  <div class="help-pic" inert>
    <template v-if="kind === 'add'">
      <HelpBoard
        class="help-pic-board shifted"
        :tokens="[{ slug: 'valen', at: [2, 0] }]"
        :highlight="[2, 2]"
      />
      <div class="help-popup help-mouse">
        <span class="help-popup-select">{{ label('all-heroes') }}<span>▾</span></span>
        <span class="help-popup-search">{{ label('search-heroes-placeholder') }}</span>
        <span class="help-popup-grid">
          <GuidePortrait v-for="slug in POPUP_HEROES" :key="slug" :slug :lang :size="20" />
        </span>
      </div>
      <div class="help-touch-list help-touch">
        <GuidePortrait
          v-for="(slug, i) in POPUP_HEROES.slice(0, 4)"
          :key="slug"
          :slug
          :lang
          :size="26"
          :class="{ tapped: i === 0 }"
        />
      </div>
    </template>

    <template v-else-if="kind === 'skills' && skill">
      <span class="help-press">
        <GuidePortrait :slug="skill.hero" :lang :size="52" />
        <span class="help-ring help-touch" />
        <svg class="help-glyph help-mouse" viewBox="0 0 24 24">
          <rect
            x="6"
            y="2.5"
            width="12"
            height="19"
            rx="6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
          />
          <path d="M12 2.5v7.5" stroke="currentColor" stroke-width="1.8" />
          <path d="M12.9 3.5a5 5 0 0 1 4.2 5.6h-4.2z" class="help-glyph-button" />
        </svg>
      </span>
      <div class="help-skill-card">
        <b>{{ skill.heroName }}</b>
        <i>{{ skill.title }}</i>
        <small>{{ skill.meta }}</small>
        <span>{{ skill.text }}</span>
      </div>
    </template>

    <HelpBoard
      v-else-if="kind === 'move'"
      class="help-pic-board wide"
      :tokens="[{ slug: 'frieren', at: [1, 3] }]"
      :origin="[2, 1]"
      :arrow="{ from: [2, 1], to: [1, 3], kind: 'move' }"
    />

    <template v-else-if="kind === 'remove'">
      <HelpBoard class="help-pic-board small" :tokens="[{ slug: 'rhys', at: [2, 2] }]" />
      <span class="help-pic-list">
        <GuidePortrait slug="gerda" :lang :size="30" />
        <GuidePortrait slug="rhys" :lang :size="30" class="placed" />
        <GuidePortrait slug="thoran" :lang :size="30" />
      </span>
    </template>

    <template v-else-if="kind === 'target'">
      <span class="help-pic-stack">
        <HelpToggle :label="label('skills')" on />
        <HelpBoard
          class="help-pic-board"
          :tokens="[
            { slug: 'frieren', at: [2, 1] },
            { slug: 'thoran', at: [0, 3] },
          ]"
          :arrow="{ from: [2, 1], to: [0, 3], kind: 'target' }"
        />
      </span>
    </template>

    <span v-else-if="kind === 'share'" class="help-pic-buttons">
      <span class="control-btn"
        ><IconLink :size="14" class="btn-icon" /><span class="btn-text">{{
          label('link')
        }}</span></span
      >
      <span class="control-btn"
        ><IconCopy :size="14" class="btn-icon" /><span class="btn-text">{{
          label('copy')
        }}</span></span
      >
      <span class="control-btn"
        ><IconDownload :size="14" class="btn-icon" /><span class="btn-text">{{
          label('download')
        }}</span></span
      >
    </span>
  </div>
</template>

<style scoped>
.help-pic {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 150px;
  overflow: hidden;
  font-family: var(--font-ui);
  background: var(--help-panel);
  border-radius: var(--radius-large);
}

.help-pic-board.shifted {
  margin-right: 120px;
}

.help.touch .help-pic-board.shifted {
  margin: 0 0 40px;
}

.help-pic-board.wide {
  width: 180px;
}

.help-pic-board.small {
  width: 112px;
}

.help-pic-list,
.help-pic-buttons {
  display: flex;
  gap: 8px;
}

.help-pic-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* Copy of CharacterSelectionPopup. */
.help-popup {
  position: absolute;
  top: 16px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 128px;
  padding: 8px;
  background: rgba(38, 38, 40, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-large);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
}

.help-popup-select {
  display: flex;
  justify-content: space-between;
  padding: 3px 7px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 5px;
  color: #eee;
  font-size: 0.6rem;
  font-weight: 700;
}

.help-popup-search {
  padding: 3px 7px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 5px;
  color: #999;
  font-size: 0.58rem;
}

.help-popup-grid {
  display: flex;
  justify-content: space-between;
}

.help-touch-list {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border-primary);
}

.help-touch-list .tapped {
  outline: 2.5px solid var(--color-primary);
  outline-offset: 3px;
}

/* Inline-flex so the ring fits the portrait, not the text line. */
.help-press {
  position: relative;
  display: inline-flex;
}

.help-ring {
  position: absolute;
  inset: -4px;
  border: 3px solid var(--color-primary);
  border-right-color: transparent;
  border-bottom-color: transparent;
  border-radius: 50%;
  transform: rotate(-20deg);
}

.help-glyph {
  position: absolute;
  right: -12px;
  bottom: -8px;
  width: 26px;
  height: 26px;
  padding: 4px;
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.help-glyph-button {
  fill: var(--color-primary);
}

/* Copy of SkillModal, cut down. */
.help-skill-card {
  width: 170px;
  padding: 10px 12px 11px;
  background: rgba(20, 20, 20, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-large);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4);
  color: #fff;
  font-family: var(--font-content);
}

.help-skill-card b {
  display: block;
  margin-bottom: 5px;
  font-size: 0.86rem;
}

.help-skill-card i {
  display: block;
  margin-bottom: 4px;
  padding-bottom: 4px;
  border-bottom: 1.5px solid rgba(255, 255, 255, 0.3);
  font-style: normal;
  font-size: 0.68rem;
  font-weight: 700;
}

.help-skill-card small {
  display: block;
  margin-bottom: 3px;
  color: #aaa;
  font-size: 0.54rem;
}

.help-skill-card span {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  overflow: hidden;
  font-size: 0.6rem;
  line-height: 1.45;
  color: #eee;
}

@container help (max-width: 560px) {
  .help-pic {
    height: 132px;
  }
}
</style>
