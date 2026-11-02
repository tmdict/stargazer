// Gives the guide index the set the PvP team generator gives before a
// roster is picked, as `virtual:sl-preview`. The generator's own code works
// it out (src/lib/pvp/sl/generator/defaultSet.ts), through Vite's module
// runner so the app's imports resolve, and the page receives the set alone.
// The runner (`runnerImport`) is marked experimental in Vite, so a Vite
// upgrade checks that the guide index still draws the card.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerImport, type Plugin, type ResolvedConfig } from 'vite'

const ID = 'virtual:sl-preview'
const RESOLVED = `\0${ID}`

export function slPreview(): Plugin {
  let config: ResolvedConfig

  return {
    name: 'sl-preview',
    configResolved(resolved) {
      config = resolved
    },
    resolveId: (id) => (id === ID ? RESOLVED : undefined),
    async load(id) {
      if (id !== RESOLVED) return
      // A copy without the data pack runs with no preview on the guide index. A
      // build never gets here without it.
      if (!readFileSync(join(config.root, 'src/pack/pvp/sl.key'), 'utf8').trim()) {
        config.logger.warn('sl-preview: no data pack, so the guide index shows no preview')
        return 'export default null'
      }
      const file = join(config.root, 'src/pack/pvp/sl.bin')
      this.addWatchFile(file)
      const { module, dependencies } = await runnerImport<{
        defaultSlSet: (bytes: Uint8Array) => Promise<unknown>
      }>(join(config.root, 'src/lib/pvp/sl/generator/defaultSet.ts'), {
        configFile: false,
        root: config.root,
        resolve: { alias: config.resolve.alias },
        logLevel: 'error',
      })
      // The dev server works the set out again when the code or data it read changes.
      for (const dependency of dependencies) this.addWatchFile(dependency)
      return `export default ${JSON.stringify(await module.defaultSlSet(readFileSync(file)))}`
    },
  }
}
