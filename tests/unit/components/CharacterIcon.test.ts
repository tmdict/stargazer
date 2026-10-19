// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import CharacterIcon from '@/components/CharacterIcon.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

/* The tick circle: only a host that asks for it draws one. */

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

const mountIcon = async (props: { tickable?: boolean; ticked?: boolean }): Promise<HTMLElement> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const gameData = useGameDataStore()
  gameData.initializeContentData()
  const character = gameData.characters.find((c) => !c.placeholder)!
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(CharacterIcon, { character, ...props }) })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return host
}

describe('CharacterIcon tick', () => {
  it('draws no circle for a host that leaves the tick props out', async () => {
    const host = await mountIcon({})
    expect(host.querySelector('.tick')).toBeNull()
    expect(host.querySelector('.character-display.ticked')).toBeNull()
  })

  it('draws an empty circle when tickable and fills it once ticked', async () => {
    expect((await mountIcon({ tickable: true })).querySelector('.tick:not(.on)')).not.toBeNull()
    teardown?.()
    const host = await mountIcon({ tickable: true, ticked: true })
    expect(host.querySelector('.tick.on')).not.toBeNull()
    expect(host.querySelector('.character-display.ticked')).not.toBeNull()
  })
})
