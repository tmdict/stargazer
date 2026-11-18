import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  mirror,
  packCommit,
  packProblems,
  pinNotice,
  pinProblem,
  writeGenerated,
} from '../../scripts/lib/dataPack'
import { GLOSSARY } from '../../src/lib/glossary'
import { FRAME_NAMES } from '../../src/lib/import/card/frames'
import { APP_LOCALES, SKILL_LOCALES } from '../../src/lib/types/i18n'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'stargazer-pack-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function put(path: string, text = '{}'): void {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
}

describe('skill bundling files', () => {
  it('go only where the pack holds the language', () => {
    put('pack/text/skill/en/odie.json')
    put('pack/text/skill/ja/odie.json')
    writeGenerated(join(dir, 'pack'))

    expect(existsSync(join(dir, 'pack/text/skill/ja/index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'pack/text/skill/ko/index.ts'))).toBe(false)
  })
})

describe('mirror', () => {
  it('deletes what the source lost and keeps the generated files', () => {
    put('source/images/character/odie.png', 'a')
    put('source/text/skill/en/odie.json')
    put('source/images/seasonal/artifact/frosthelm.png')
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(3)
    writeGenerated(join(dir, 'pack'))

    rmSync(join(dir, 'source/images/seasonal'), { recursive: true })
    put('source/images/character/odie.png', 'b')
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(2)

    expect(readFileSync(join(dir, 'pack/images/character/odie.png'), 'utf8')).toBe('b')
    expect(existsSync(join(dir, 'pack/images/seasonal'))).toBe(false)
    expect(existsSync(join(dir, 'pack/text/skill/en/index.ts'))).toBe(true)
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(0)
  })
})

describe('build checks', () => {
  const TERMS = Object.values(GLOSSARY).flat()
  const glossary = (keywords: object[]): string => JSON.stringify({ stats: [], keywords })

  // One hero, one permanent artifact, a season whose text is not out yet, and
  // a glossary in which the game names and describes every listed term.
  beforeEach(() => {
    for (const path of [
      'src/data/character/odie',
      'src/data/artifact/starshard',
      'src/data/seasonal/artifact/frosthelm',
      'src/data/seasonal/phantimal/beetle',
    ])
      put(`repo/${path}.json`)
    for (const path of [
      'images/character/odie',
      'images/artifact/starshard',
      'images/seasonal/artifact/frosthelm',
      'images/seasonal/phantimal/beetle',
      'screenshot-import/replay-arena',
      ...FRAME_NAMES.map((name) => `screenshot-import/frame-${name}`),
    ])
      put(`pack/${path}.png`, 'png')
    for (const { code } of SKILL_LOCALES) put(`pack/text/skill/${code}/odie.json`)
    put('pack/text/skill/numbers.json', '{ "odie": {} }')
    put('pack/screenshot-import/hero-icons.json', '{ "icons": [1] }')
    put('pack/pvp/pvp.bin', 'x')
    put('pack/pvp/pvp.key', 'x')
    put('pack/text/skill/en/_artifacts.json', '{ "starshard": { "name": "", "levels": [] } }')
    for (const lang of APP_LOCALES) {
      put(
        `pack/text/skill/${lang}/_glossary.json`,
        glossary(TERMS.map((key) => ({ key, n: 'name', d: 'text' }))),
      )
    }
  })

  it('stop on a glossary term left unnamed or with neither description nor picture', () => {
    // The game gives stun nothing, blind a name alone and freeze a blank
    // description; blind has a picture.
    const entries = TERMS.filter((key) => key !== 'stun').map((key) => ({
      key,
      n: 'name',
      ...(key === 'blind' ? {} : { d: key === 'freeze' ? '' : 'text' }),
    }))
    put('pack/text/skill/ko/_glossary.json', glossary([...entries, { key: 'new-term', d: 'text' }]))
    put('pack/text/skill/en/_glossary.json', glossary([...entries, { key: 'new-term', d: 'text' }]))
    put(
      'repo/src/locales/glossary/stun.json',
      '{ "name": { "en": "Stun" }, "description": { "en": "text", "ko": "text" } }',
    )
    put('pack/images/keyword/blind.png', 'png')
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), [])).toEqual({
      problems: [
        'the en glossary has no description or picture for freeze',
        'the ko glossary has no name for stun',
        'the ko glossary has no description or picture for freeze',
      ],
      notes: [
        'frosthelm has no text in the pack',
        'beetle has no text in the pack',
        "the Glossary page does not list the pack's new-term",
      ],
    })
  })

  it('note seasonal text that is not out yet', () => {
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), [])).toEqual({
      problems: [],
      notes: ['frosthelm has no text in the pack', 'beetle has no text in the pack'],
    })
  })

  it('note a board picture in neither picture folder', () => {
    expect(
      packProblems(join(dir, 'pack'), join(dir, 'repo'), ['odie', 'beetle', 'turret']).notes,
    ).toEqual([
      'frosthelm has no text in the pack',
      'beetle has no text in the pack',
      'the board picture turret is not in the pack',
    ])
  })

  it('stop on a summary with no report', () => {
    put('pack/pvp/s9/summary.json', '{ "season": 9 }')
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), []).problems).toEqual([
      'the s9 summary has no report in the pack',
    ])
  })

  it('stop on charm text and the charm hero list arriving apart', () => {
    put('pack/text/skill/en/_charms.json')
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), []).problems).toEqual([
      'the pack has charm text but no hero-charms.json',
    ])
    rmSync(join(dir, 'pack/text/skill/en/_charms.json'))
    put('pack/text/skill/hero-charms.json')
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), []).problems).toEqual([
      'the pack has hero-charms.json but no charm text',
    ])
  })

  it('stop on a charm type with no picture', () => {
    put('pack/text/skill/en/_charm-types.json', '{ "acute": {}, "arcane": {} }')
    put('pack/images/seasonal/charm/acute.png')
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), []).problems).toEqual([
      'the charm type arcane has no picture in the pack',
    ])
  })

  it('stop on a missing paragon frame', () => {
    rmSync(join(dir, 'pack/screenshot-import/frame-p4-crown.png'))
    expect(packProblems(join(dir, 'pack'), join(dir, 'repo'), []).problems).toEqual([
      'the pack has no screenshot-import/frame-p4-crown.png',
    ])
  })
})

describe('pin', () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', ['-C', cwd, ...args], { stdio: 'ignore' })

  // A repo with the pack in export/ beside another project's folder, pushed
  // to a bare remote.
  function repo(): { work: string; pack: string } {
    const work = join(dir, 'work')
    execFileSync('git', ['init', '--bare', '-q', join(dir, 'remote.git')])
    execFileSync('git', ['init', '-q', '-b', 'main', work])
    git(work, 'config', 'user.email', 'test@example.com')
    git(work, 'config', 'user.name', 'test')
    git(work, 'config', 'commit.gpgsign', 'false')
    git(work, 'remote', 'add', 'origin', join(dir, 'remote.git'))
    put('work/export/text/skill/en/odie.json')
    put('work/other/notes.txt', 'a')
    git(work, 'add', '-A')
    git(work, 'commit', '-q', '-m', 'first')
    git(work, 'push', '-q', '-u', 'origin', 'main')
    return { work, pack: join(work, 'export') }
  }

  it('refuses a folder with unsaved files or unpushed commits', () => {
    const { work, pack } = repo()
    expect(pinProblem(pack)).toBeNull()

    put('work/export/text/skill/en/eironn.json')
    expect(pinProblem(pack)).toMatch(/1 uncommitted or untracked file;/)

    git(work, 'add', '-A')
    git(work, 'commit', '-q', '-m', 'second')
    expect(pinProblem(pack)).toMatch(/not pushed/)
  })

  it('notices changes inside the pack folder only', () => {
    const { work, pack } = repo()
    const pin = packCommit(pack)
    expect(pinNotice(pack, pin)).toBeNull()

    put('work/other/notes.txt', 'b')
    git(work, 'commit', '-q', '-am', 'other project')
    expect(pinNotice(pack, pin)).toBeNull()

    put('work/export/text/skill/en/eironn.json')
    expect(pinNotice(pack, pin)).toMatch(/1 uncommitted or untracked file\)/)

    git(work, 'add', '-A')
    git(work, 'commit', '-q', '-m', 'export')
    expect(pinNotice(pack, pin)).toMatch(/differs from the pinned version$/)
    expect(pinNotice(pack, packCommit(pack))).toBeNull()
  })
})
