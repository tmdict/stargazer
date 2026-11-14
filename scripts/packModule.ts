// A module worked out from the data pack's PvP data file once per build, as
// `virtual:<name>`, so a page gets the part it shows without loading the file
// or its decoder. The app's own code works it out (`run`, exported by `entry`),
// through Vite's module runner so the app's imports resolve. The runner
// (`runnerImport`) is marked experimental in Vite, so a Vite upgrade checks
// that the Formation engine rules page still draws its lists.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runnerImport, type Plugin, type ResolvedConfig } from 'vite'

interface PackModule {
  name: string
  // Relative to the project root.
  entry: string
  run: string
  // What a copy without the data pack goes without, for its warning.
  without: string
}

type Run = (bytes: Uint8Array<ArrayBuffer>) => Promise<unknown>

export function packModule({ name, entry, run, without }: PackModule): Plugin {
  const id = `virtual:${name}`
  const resolved = `\0${id}`
  let config: ResolvedConfig

  return {
    name,
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    resolveId: (source) => (source === id ? resolved : undefined),
    async load(source) {
      if (source !== resolved) return
      // A copy without the data pack runs with null. A build never gets here
      // without it.
      if (!readFileSync(join(config.root, 'src/pack/pvp/pvp.key'), 'utf8').trim()) {
        config.logger.warn(`${name}: no data pack, so ${without}`)
        return 'export default null'
      }
      const file = join(config.root, 'src/pack/pvp/pvp.bin')
      this.addWatchFile(file)
      const { module, dependencies } = await runnerImport<Record<string, Run>>(
        join(config.root, entry),
        {
          configFile: false,
          root: config.root,
          resolve: { alias: config.resolve.alias },
          logLevel: 'error',
        },
      )
      // The dev server works the module out again when the code or data it read changes.
      for (const dependency of dependencies) this.addWatchFile(dependency)
      return `export default ${JSON.stringify(await module[run]!(readFileSync(file)))}`
    },
  }
}
