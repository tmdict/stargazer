// Gives the guide index the set the Supreme League generator gives before a
// roster is picked, as `virtual:sl-preview`. The generator's own code works it
// out (src/lib/pvp/sl/defaultSet.ts), through Vite's module runner so the
// app's imports resolve, and the page receives the set alone.
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
      const file = join(config.root, 'src/content/pvp/sl/sl.bin')
      this.addWatchFile(file)
      const { module } = await runnerImport<{
        defaultSlSet: (bytes: Uint8Array) => Promise<unknown>
      }>(join(config.root, 'src/lib/pvp/sl/defaultSet.ts'), {
        configFile: false,
        root: config.root,
        resolve: { alias: config.resolve.alias },
        logLevel: 'error',
      })
      return `export default ${JSON.stringify(await module.defaultSlSet(readFileSync(file)))}`
    },
  }
}
