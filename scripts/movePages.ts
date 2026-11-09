// The move's old-address pages: the script that hands a visitor's data over as
// an old page opens, and the recovery page served at the old address's /backup.
// Both run without the app, so the packing code is inlined as text.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

import {
  LINK_MARK,
  MAX_CODE_LENGTH,
  MOVE_STAGE,
  OLD_HOST,
  ROSTERS_KEY,
  TEAMS_KEY,
  TRAVEL_KEYS,
} from '../src/lib/move/config.ts'
import { packLink } from '../src/lib/move/pack.ts'
import { SITE_ORIGIN } from '../src/lib/site.ts'
import { APP_LOCALES } from '../src/lib/types/i18n.ts'

const text = (value: unknown): string => JSON.stringify(value)

const PACK = `(${packLink.toString()})(localStorage,${text(TRAVEL_KEYS)},${text(LINK_MARK)},${MAX_CODE_LENGTH})`

// Blocked storage holds nothing to carry, so a failure to read it leaves as a
// plain redirect does.
const SENDER = `;(function () {
  if (location.hostname !== ${text(OLD_HOST)}) return
  var page = ${text(SITE_ORIGIN)} + location.pathname + location.search
  var leave = function (code) {
    location.replace(page + (code === null ? location.hash : code))
  }
  try {
    ${PACK}.then(leave, function () {
      leave(null)
    })
  } catch (e) {
    leave(null)
  }
})()`

const RECOVERY_STYLE = `
:root { color-scheme: light; --bg: #f4f5f7; --panel: #fff; --text: #1f2430; --muted: #5c6370; --line: #d5d9e0; --accent: #2f6fde; }
:root[data-theme='dark'] { color-scheme: dark; --bg: #1b1e24; --panel: #262a33; --text: #e6e8ec; --muted: #a3a9b5; --line: #3a3f4b; --accent: #7aa7f7; }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--text); font: 16px/1.5 sans-serif; }
main { max-width: 560px; margin: 0 auto; padding: 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
h1 { margin: 0 0 12px; font-size: 22px; }
p { margin: 0 0 14px; }
.muted { color: var(--muted); font-size: 14px; }
.actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 0 0 16px; }
button { padding: 9px 16px; border: 0; border-radius: 6px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
:root[data-theme='dark'] button { color: #10131a; }
a { color: var(--accent); }
`

function recoveryStrings(root: string): Record<string, Record<string, string>> {
  const strings: Record<string, Record<string, string>> = {}
  for (const locale of APP_LOCALES) strings[locale] = {}
  for (const folder of ['src/locales/app', 'src/locales/app/messages']) {
    for (const file of readdirSync(join(root, folder))) {
      const name = /^move-recovery-(.+)\.json$/.exec(file)?.[1]
      if (!name) continue
      const entry = JSON.parse(readFileSync(join(root, folder, file), 'utf8')) as Record<
        string,
        string
      >
      for (const locale of APP_LOCALES) {
        const value = entry[locale]
        if (!value) throw new Error(`${file} has no ${locale} text for the recovery page`)
        strings[locale]![name] = value
      }
    }
  }
  return strings
}

// `?bring=<path>` asks the page to send the data to that page of the new
// address. The path is appended to the fixed address and must start with one
// slash, so the link cannot send anyone to another site.
const recoveryScript = (strings: Record<string, Record<string, string>>): string => `;(function () {
  var NEW = ${text(SITE_ORIGIN)}
  var read = function (key) {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      return null
    }
  }
  var records = function (key) {
    try {
      var list = JSON.parse(read(key))
      return Array.isArray(list) ? list : []
    } catch (e) {
      return []
    }
  }
  var theme
  try {
    theme = JSON.parse(read('stargazer.prefs')).theme
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark')
    theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.setAttribute('data-theme', theme)

  var all = ${text(strings)}
  var lang = read('stargazer.locale')
  var t = all[lang] || all.en
  document.documentElement.lang = all[lang] ? lang : 'en'
  document.title = t.title

  var main = document.querySelector('main')
  var add = function (tag, content, parent) {
    var el = document.createElement(tag)
    el.textContent = content
    ;(parent || main).appendChild(el)
    return el
  }
  var backLink = function (page) {
    add('a', t.back, add('p', '')).href = NEW + page
  }
  add('h1', t.title)

  var bring = new URLSearchParams(location.search).get('bring')
  // Only the old address holds data to send.
  if (bring !== null && location.hostname === ${text(OLD_HOST)}) {
    var page = /^\\/(?![\\/\\\\])/.test(bring) ? bring.split('#')[0] : '/'
    var status = add('p', t.working)
    var arrive = function (code) {
      if (code !== null) return location.replace(NEW + page + code)
      status.textContent = t.nothing
      backLink(page)
    }
    try {
      ${PACK}.then(arrive, function () {
        arrive(null)
      })
    } catch (e) {
      arrive(null)
    }
    return
  }

  var teams = records(${text(TEAMS_KEY)})
  var rosters = records(${text(ROSTERS_KEY)})
  var download = function (kind, listKey, list, prefix) {
    var file = { app: 'stargazer', kind: kind, exportedAt: new Date().toISOString() }
    file[listKey] = list
    var now = new Date()
    var two = function (n) {
      return String(n).padStart(2, '0')
    }
    var stamp =
      now.getFullYear() + two(now.getMonth() + 1) + two(now.getDate()) + '-' +
      two(now.getHours()) + two(now.getMinutes()) + two(now.getSeconds())
    var link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }))
    link.download = prefix + '-' + stamp + '.json'
    link.click()
  }
  if (!teams.length && !rosters.length) {
    add('p', t.empty)
  } else {
    add('p', t.found.replace('{teams}', teams.length).replace('{rosters}', rosters.length))
    var actions = add('div', '')
    actions.className = 'actions'
    if (teams.length)
      add('button', t.teams, actions).onclick = function () {
        download('saved-teams', 'teams', teams, 'stargazer-teams')
      }
    if (rosters.length)
      add('button', t.rosters, actions).onclick = function () {
        download('rosters', 'rosters', rosters, 'stargazer-rosters')
      }
    add('p', t.how).className = 'muted'
  }
  backLink('/')
})()`

const recoveryPage = (root: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>Stargazer</title>
<style>${RECOVERY_STYLE}</style>
</head>
<body>
<main></main>
<script>${recoveryScript(recoveryStrings(root))}</script>
</body>
</html>
`

export function movePages(): Plugin[] {
  let config: ResolvedConfig

  return [
    {
      name: 'move-sender',
      // Ahead of the stylesheets: after them, an inline script holds the
      // page's parsing until they load, and the visitor is leaving anyway.
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => {
          if (MOVE_STAGE !== 1) return html
          // The app waits forever on the old address, so a page without the
          // script would never leave it.
          if (!html.includes('<title>')) {
            throw new Error('index.html has no <title> to put the sender before')
          }
          return html.replace('<title>', () => `<script>${SENDER}</script>\n    <title>`)
        },
      },
    },
    {
      name: 'move-recovery',
      apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
      configResolved(resolved) {
        config = resolved
      },
      buildStart() {
        // Once the old address redirects, an old page no longer runs its
        // script, so the stage and the redirect rule have to change together.
        const rules = readFileSync(join(config.publicDir, '_redirects'), 'utf8')
          .split('\n')
          .map((line) => line.trim())
        const all = rules.findIndex((line) => line.startsWith(`https://${OLD_HOST}/* `))
        const backup = rules.findIndex((line) => line.startsWith(`https://${OLD_HOST}/backup `))
        if ((all !== -1) !== (MOVE_STAGE === 2)) {
          this.error(
            `MOVE_STAGE is ${MOVE_STAGE}, so public/_redirects ${all !== -1 ? 'must not' : 'must'} redirect https://${OLD_HOST}/*`,
          )
        }
        // The host takes the first rule that matches.
        if (backup === -1 || (all !== -1 && all < backup)) {
          this.error(
            `public/_redirects must serve https://${OLD_HOST}/backup above any rule for https://${OLD_HOST}/*`,
          )
        }
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'move-recovery.html',
          source: recoveryPage(config.root),
        })
      },
    },
  ]
}
