// Hydrates the PvP report templates in src/content/pvp with this client
// build's shared hero and pre-season artifact URLs. Seasonal icons are
// embedded in the template.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { normalizePath, type Plugin, type ResolvedConfig } from 'vite'

import { seasonArtifactImageUrl } from '../src/utils/artifactImage.ts'

export function guideReports(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'guide-reports',
    apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
    configResolved(resolved) {
      config = resolved
    },
    generateBundle(_options, bundle) {
      const directory = join(config.root, 'src/content/pvp')
      if (!existsSync(directory)) return
      const seasons = readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && /^s\d+$/.test(entry.name))
        .map((entry) => entry.name)
        .sort()
      if (!seasons.length) return

      // Follow the shared module's imports so the matcher variant cannot be
      // selected just because it came from the same original PNG.
      const images = this.getModuleInfo(
        normalizePath(join(config.root, 'src/utils/imageAssets.ts')),
      )
      if (!images) this.error('Guide images are missing from the client build')
      const files = new Map<string, string>()
      for (const id of images.importedIds) {
        const source = normalizePath(relative(config.root, id.split('?')[0]!))
        const key = /^src\/assets\/images\/(character|artifact)\/([a-z0-9-]+)\.png$/.exec(source)
        if (!key) continue
        // vite-imagetools returns Vite's emitted-asset token. Resolve its
        // reference through the bundler, which owns the final hashed filename.
        const code = this.getModuleInfo(id)?.code ?? ''
        const refs = [...code.matchAll(/__VITE_ASSET__([\w$]+)__/g)]
        if (refs.length !== 1) this.error(`Expected one emitted guide image: ${source}`)
        const file = this.getFileName(refs[0]![1]!)
        if (!bundle[file]) this.error(`Guide image was not emitted: ${source}`)
        files.set(`${key[1]}/${key[2]}`, file)
      }

      for (const season of seasons) {
        const fileName = `guide/pvp/${season}/index.html`
        if (
          bundle[fileName] ||
          (config.publicDir && existsSync(join(config.publicDir, fileName)))
        ) {
          this.error(`Guide output already exists: ${fileName}; keep its template only`)
        }
        const template = readFileSync(join(directory, season, 'index.template.html'), 'utf8')
        const html = template.replace(
          /\{\{asset:(character|artifact|seasonal-artifact)\/([a-z0-9-]+)\}\}/g,
          (_marker, type: string, slug: string) => {
            if (type === 'seasonal-artifact') return seasonArtifactImageUrl(slug)
            const file = files.get(`${type}/${slug}`)
            if (!file) this.error(`Missing guide image in ${season}: ${type}/${slug}`)
            return config.base + file
          },
        )
        if (html.includes('{{asset:')) this.error(`Unresolved guide image placeholder in ${season}`)
        this.emitFile({ type: 'asset', fileName, source: html })
      }
    },
  }
}
