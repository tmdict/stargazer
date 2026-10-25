import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  mirror,
  packCommit,
  pinNotice,
  pinProblem,
  skillHeroes,
  writeGenerated,
} from '../../scripts/lib/dataPack'

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

describe('skill hero list', () => {
  it('comes from the English file names, without underscore files', () => {
    for (const name of ['odie', '_terms', 'eironn']) put(`pack/text/skill/en/${name}.json`)
    put('pack/text/skill/ja/odie.json')
    writeGenerated(join(dir, 'pack'))

    expect(skillHeroes(join(dir, 'pack'))).toEqual(['eironn', 'odie'])
    expect(JSON.parse(readFileSync(join(dir, 'pack/data/skill/heroes.json'), 'utf8'))).toEqual([
      'eironn',
      'odie',
    ])
    expect(existsSync(join(dir, 'pack/text/skill/ja/index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'pack/text/skill/ko/index.ts'))).toBe(false)
  })
})

describe('mirror', () => {
  it('deletes what the source lost and keeps the generated files', () => {
    put('source/images/character/odie.png', 'a')
    put('source/text/skill/en/odie.json')
    put('source/text/seasonal/artifact/frosthelm.json')
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(3)
    writeGenerated(join(dir, 'pack'))

    rmSync(join(dir, 'source/text/seasonal'), { recursive: true })
    put('source/images/character/odie.png', 'b')
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(2)

    expect(readFileSync(join(dir, 'pack/images/character/odie.png'), 'utf8')).toBe('b')
    expect(existsSync(join(dir, 'pack/text/seasonal'))).toBe(false)
    expect(existsSync(join(dir, 'pack/text/skill/en/index.ts'))).toBe(true)
    expect(existsSync(join(dir, 'pack/data/skill/heroes.json'))).toBe(true)
    expect(mirror(join(dir, 'source'), join(dir, 'pack'))).toBe(0)
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
