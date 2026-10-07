<script setup lang="ts">
/* TEMPORARY, this branch only: the site's hand-written Korean beside its
   English, for Korean players to review. Unlisted, client-only and not
   pre-rendered, so it reaches no sitemap. It reads the locale and content
   files themselves and so always shows the branch's current wording.

   Delete before the branch merges into main:
   1. this folder (src/review/)
   2. the `ko-review` record in src/router/routes.ts
   3. the `export` on GUIDE_META and HELP_META in src/utils/contentMeta.ts

   One row is one file: an app string, a page's title and description, or a
   whole content file. What comes straight from the game's data is left out:
   hero, artifact and phantimal names, the game terms and all skill text. A
   row marked `wording` is an app label typed by hand whose Korean matches an
   in-game string exactly (gameWording.json, a one-off list). */

import { computed, ref } from 'vue'
import { useHead } from '@unhead/vue'

import type { LocaleData } from '@/lib/types/i18n'
import { GUIDE_META, HELP_META } from '@/utils/contentMeta'
import { loadTagVocabulary } from '@/utils/tagData'
import gameWording from './gameWording.json'

import '@/styles/content.css'

type Source = 'hand' | 'wording'

interface Pair {
  en: string
  ko: string
}

interface Row {
  id: string
  source: Source
  pairs: Pair[]
}

interface Section {
  id: string
  ko: string
  en: string
  rows: Row[]
  // Set when a content file's English and Korean do not line up.
  warning?: string
}

const SOURCES: Record<Source, { ko: string; en: string }> = {
  hand: { ko: '직접 번역', en: 'Hand-written' },
  wording: { ko: '게임 표기', en: 'In-game wording' },
}

useHead({
  title: 'Korean translation review | Stargazer',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

// ---- app strings ----

const appStrings = import.meta.glob<LocaleData>('@/locales/app/**/*.json', {
  eager: true,
  import: 'default',
})

const wording = new Set<string>(gameWording)
const vocabulary = loadTagVocabulary()
const tagKeys = new Set([...vocabulary.keys(), ...[...vocabulary.values()].flatMap((t) => t.mods)])

const labels: Row[] = []
const sentences: Row[] = []
const tags: Row[] = []
for (const [path, text] of Object.entries(appStrings).sort(([a], [b]) => a.localeCompare(b))) {
  const key = path.slice(path.lastIndexOf('/') + 1, -'.json'.length)
  const row: Row = {
    id: key,
    source: wording.has(text.ko) ? 'wording' : 'hand',
    pairs: [{ en: text.en, ko: text.ko }],
  }
  if (path.includes('/messages/')) sentences.push(row)
  else if (tagKeys.has(key)) tags.push(row)
  else labels.push(row)
}

const pageMeta = [
  ...Object.entries(GUIDE_META).map(([page, meta]) => [`guide ${page}`, meta] as const),
  ['help', HELP_META] as const,
].map(([id, meta]): Row => ({
  id,
  source: 'hand',
  pairs: [
    { en: meta.en.title, ko: meta.ko.title },
    { en: meta.en.description, ko: meta.ko.description },
  ],
}))

// ---- content files ----

/* The notes, About and Help are components, one file per language with the
   same structure. Their text is read from the template source: every literal
   attribute and every block of text, in order, so the nth of one file is the
   nth of the other. What is identical in both (class names, key names) is
   not a translation and drops out. */
const contentSources = import.meta.glob<string>('@/content/**/*.{en,ko}.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function templateTexts(source: string): string[] {
  const template = source.slice(
    source.indexOf('<template>') + '<template>'.length,
    source.lastIndexOf('</template>'),
  )
  const html = template
    .replace(/<!--[\s\S]*?-->/g, '')
    // A <template> keeps its children out of the tree, and HTML has no
    // self-closing tags: an unclosed component would swallow what follows.
    .replace(/<(\/?)template\b/g, '<$1div')
    .replace(/<([A-Za-z][\w-]*)((?:"[^"]*"|'[^']*'|[^'">])*?)\/>/g, '<$1$2></$1>')
  const texts: string[] = []
  const walk = (el: Element): void => {
    for (const attr of el.attributes) texts.push(attr.value)
    const ownText = [...el.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    )
    if (ownText) texts.push((el.textContent ?? '').replace(/\s+/g, ' ').trim())
    else for (const child of el.children) walk(child)
  }
  walk(new DOMParser().parseFromString(html, 'text/html').body)
  return texts
}

function contentSection(id: string, ko: string, en: string, folder: string): Section {
  const rows: Row[] = []
  const uneven: string[] = []
  for (const path of Object.keys(contentSources).sort()) {
    if (!path.includes(folder) || !path.endsWith('.en.vue')) continue
    const enTexts = templateTexts(contentSources[path]!)
    const koTexts = templateTexts(contentSources[path.replace('.en.vue', '.ko.vue')] ?? '')
    const file = path.slice(path.lastIndexOf('/') + 1, -'.en.vue'.length)
    if (enTexts.length !== koTexts.length) uneven.push(file)
    const pairs = enTexts
      .map((text, i) => ({ en: text, ko: koTexts[i] ?? '' }))
      .filter((pair) => pair.en !== pair.ko)
    if (pairs.length) rows.push({ id: file, source: 'hand', pairs })
  }
  return {
    id,
    ko,
    en,
    rows,
    warning: uneven.length
      ? `English and Korean do not line up in: ${uneven.join(', ')}`
      : undefined,
  }
}

// ---- the page ----

const sections: Section[] = [
  { id: 'labels', ko: '인터페이스 라벨', en: 'Interface labels', rows: labels },
  { id: 'sentences', ko: '인터페이스 문장', en: 'Interface sentences', rows: sentences },
  { id: 'tags', ko: '메커니즘 태그', en: 'Mechanic tags', rows: tags },
  contentSection('notes', '영웅 노트', 'Hero notes', '/content/skill/'),
  contentSection('help', '도움말 페이지', 'Help page', '/content/help/'),
  contentSection('about', '소개', 'About', '/content/about/'),
  { id: 'meta', ko: '페이지 제목과 설명', en: 'Page titles and descriptions', rows: pageMeta },
]

const total = sections.reduce((sum, section) => sum + section.rows.length, 0)

const query = ref('')
const source = ref<Source | null>(null)

const visible = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const matches = (r: Row): boolean =>
    [r.id, ...r.pairs.flatMap((pair) => [pair.en, pair.ko])].some((text) =>
      text.toLowerCase().includes(needle),
    )
  return sections
    .map((section) => ({
      ...section,
      rows: section.rows.filter(
        (r) => (!source.value || r.source === source.value) && (!needle || matches(r)),
      ),
    }))
    .filter((section) => section.rows.length > 0)
})

const shown = computed(() => visible.value.reduce((sum, section) => sum + section.rows.length, 0))
</script>

<template>
  <main>
    <article class="container page-panel review">
      <div class="content">
        <h1 lang="ko">한국어 번역 검수</h1>
        <p lang="ko">
          Stargazer에서 직접 번역한 한국어 문구를 영어 원문과 나란히 정리한 임시 페이지입니다. 한
          줄이 파일 하나에 해당합니다. 어색하거나 틀린 표현을 발견하면 해당 줄의 ID와 함께 알려
          주세요. <strong>게임 표기</strong>로 표시된 문구는 게임에 나오는 표현과 같습니다. 영웅,
          메아리, 팬텀 이름과 게임 용어, 스킬 설명처럼 게임 데이터 그대로인 내용은 여기에 넣지
          않았습니다.
        </p>
        <p class="reading-secondary" lang="en">
          A temporary page listing the site's hand-written Korean beside its English, one row per
          file. Rows marked in-game wording use the same words as the game. Names, game terms and
          skill text that come straight from the game's data are not listed.
        </p>

        <div class="controls">
          <input
            v-model="query"
            type="search"
            class="search"
            placeholder="검색 · Search"
            aria-label="Search"
          />
          <div class="filters">
            <button type="button" class="filter" :aria-pressed="!source" @click="source = null">
              전체 · All
            </button>
            <button
              v-for="(name, key) in SOURCES"
              :key
              type="button"
              class="filter"
              :aria-pressed="source === key"
              @click="source = key"
            >
              {{ name.ko }} · {{ name.en }}
            </button>
          </div>
          <span class="reading-meta">{{ shown }} / {{ total }}</span>
        </div>

        <nav class="jump">
          <a v-for="section in visible" :key="section.id" :href="`#${section.id}`" lang="ko"
            >{{ section.ko }} ({{ section.rows.length }})</a
          >
        </nav>

        <section v-for="section in visible" :id="section.id" :key="section.id">
          <h2>
            <span lang="ko">{{ section.ko }}</span>
            <span class="reading-meta" lang="en">{{ section.en }} · {{ section.rows.length }}</span>
          </h2>
          <p v-if="section.warning" class="reading-secondary" lang="en">{{ section.warning }}</p>
          <table>
            <thead>
              <tr class="reading-meta">
                <th>ID</th>
                <th>English</th>
                <th lang="ko">한국어</th>
                <th lang="ko">출처</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in section.rows" :key="r.id">
                <td class="reading-meta id">{{ r.id }}</td>
                <td colspan="2">
                  <div class="pairs">
                    <template v-for="(pair, i) in r.pairs" :key="i">
                      <p class="reading-secondary" lang="en">{{ pair.en }}</p>
                      <p lang="ko">{{ pair.ko }}</p>
                    </template>
                  </div>
                </td>
                <td>
                  <span
                    class="meta-chip"
                    :class="r.source"
                    lang="ko"
                    :title="SOURCES[r.source].en"
                    >{{ SOURCES[r.source].ko }}</span
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </article>
  </main>
</template>

<style scoped>
.review {
  max-width: 1180px;
}

.controls {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 20px -8px 0;
  padding: 10px 8px;
  background: var(--color-bg-reading);
}

.search {
  flex: 1 1 220px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: inherit;
  font: inherit;
  font-size: max(var(--reading-secondary-size), var(--field-min-font-size));
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter {
  padding: 4px 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: var(--reading-small-size);
  cursor: pointer;
}

.filter[aria-pressed='true'] {
  border-color: var(--color-accent);
  background: var(--color-accent-active);
}

.jump {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-top: 12px;
}

section {
  margin-top: 40px;
  scroll-margin-top: 64px;
}

h2 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

th,
td {
  padding: 8px 10px 8px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: left;
  vertical-align: top;
}

th {
  font-weight: 600;
}

th:first-child {
  width: 17%;
}

th:last-child {
  width: 104px;
}

.pairs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
}

.pairs p {
  margin: 0;
}

.id {
  overflow-wrap: anywhere;
}

.meta-chip {
  white-space: nowrap;
}

.meta-chip.hand {
  background: var(--color-accent-active);
}

@media (max-width: 768px) {
  thead {
    display: none;
  }

  tr {
    display: grid;
    gap: 4px;
    padding: 10px 0;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  td {
    padding: 0;
    border: none;
  }

  .pairs {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .pairs p[lang='ko'] {
    margin-bottom: 8px;
  }
}
</style>
