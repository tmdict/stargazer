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
import { FRAME_NAMES } from '../../src/lib/import/card/frames'
import { SKILL_LOCALES } from '../../src/lib/types/i18n'

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
  // One hero, one permanent artifact and a season whose text is not out yet.
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
    put('pack/text/skill/en/_artifacts.json', '{ "starshard": { "name": "", "levels": [] } }')
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
