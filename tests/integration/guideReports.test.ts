import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { build } from 'vite'
import { imagetools } from 'vite-imagetools'
import { expect, test } from 'vitest'

import { guideReports } from '../../scripts/guideReports'

const root = fileURLToPath(new URL('../../', import.meta.url))

test('guide templates reuse display assets, preserve content and reject bad input', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'stargazer-guide-'))
  try {
    for (const path of [
      'src/utils',
      'src/assets/images/character',
      'src/assets/images/artifact',
      'src/content/pvp/s7',
    ]) {
      mkdirSync(join(dir, path), { recursive: true })
    }
    copyFileSync(join(root, 'src/utils/imageAssets.ts'), join(dir, 'src/utils/imageAssets.ts'))
    await sharp({ create: { width: 240, height: 330, channels: 4, background: '#a05080' } })
      .png()
      .toFile(join(dir, 'src/assets/images/character/evie.png'))
    await sharp({ create: { width: 120, height: 120, channels: 4, background: '#30a070' } })
      .png()
      .toFile(join(dir, 'src/assets/images/artifact/starshard.png'))
    writeFileSync(
      join(dir, 'main.ts'),
      `
      import { characterImages, artifactImages } from './src/utils/imageAssets'
      import matcher from './src/assets/images/character/evie.png?format=webp&quality=85&w=180'
      console.log(characterImages, artifactImages, matcher)
    `,
    )
    const templateFile = join(dir, 'src/content/pvp/s7/index.template.html')
    const template =
      '<h1>Anonymous report</h1><svg><image href="{{asset:character/evie}}"/><image href="{{asset:artifact/starshard}}"/><image href="{{asset:seasonal-artifact/frosthelm}}"/></svg><script>window.report = 1</script>'
    writeFileSync(templateFile, template)
    const compile = () =>
      build({
        configFile: false,
        root: dir,
        base: '/test/',
        logLevel: 'silent',
        resolve: { alias: { '@': join(dir, 'src') } },
        plugins: [imagetools({ cache: { dir: join(dir, 'cache') } }), guideReports()],
        build: { minify: false, rolldownOptions: { input: join(dir, 'main.ts') } },
      })
    await compile()
    const html = readFileSync(join(dir, 'dist/guide/pvp/s7/index.html'), 'utf8')
    const urls = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!)
    const portrait = await sharp(join(dir, 'dist', urls[0]!.slice('/test/'.length))).metadata()
    const artifact = await sharp(join(dir, 'dist', urls[1]!.slice('/test/'.length))).metadata()
    expect([portrait.width, portrait.height]).toEqual([100, 135])
    expect([artifact.width, artifact.height]).toEqual([100, 100])
    expect(urls[2]).toBe('https://chaldea.tmdict.com/img/seasonal/artifact/frosthelm.webp')
    expect(html.replace(/href="[^"]+"/g, 'href="image"')).toBe(
      template.replace(/href="[^"]+"/g, 'href="image"'),
    )
    const assets = readdirSync(join(dir, 'dist/assets'))
    expect(assets.filter((file) => file.endsWith('.webp'))).toHaveLength(3)
    const app = assets
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(join(dir, 'dist/assets', file), 'utf8'))
      .join('\n')
    expect(app).toContain(urls[0])
    expect(app).toContain(urls[1])
    writeFileSync(templateFile, template.replace('character/evie', 'character/missing'))
    await expect(compile()).rejects.toThrow('Missing guide image in s7: character/missing')
    writeFileSync(templateFile, template.replace('character/evie', 'portrait/evie'))
    await expect(compile()).rejects.toThrow('Unresolved guide image placeholder in s7')
    writeFileSync(templateFile, template)
    mkdirSync(join(dir, 'public/guide/pvp/s7'), { recursive: true })
    writeFileSync(join(dir, 'public/guide/pvp/s7/index.html'), '')
    await expect(compile()).rejects.toThrow('Guide output already exists: guide/pvp/s7/index.html')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
