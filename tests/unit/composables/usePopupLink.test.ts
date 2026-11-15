// @vitest-environment jsdom
import { createApp, defineComponent, h, nextTick, ref, watch } from 'vue'
import { createRouter, createWebHistory, RouterView, useRoute, type Router } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'

import { installPopupLinkGuard, usePopupLink } from '@/composables/usePopupLink'

const Page = defineComponent({ render: () => h('div') })

const address = (): string => location.pathname + location.search + location.hash

// Lets a navigation finish and the post-flush watchers run.
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve))
  await nextTick()
  await nextTick()
}

// jsdom moves through the history a task or more later.
const goBack = (router: Router): Promise<void> =>
  new Promise((resolve) => {
    const stop = router.afterEach(() => {
      stop()
      resolve(settle())
    })
    router.back()
  })

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

// The App wiring: About closes when the page changes, as it does at the root.
async function start(url: string) {
  history.replaceState(null, '', url)
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: Page },
      { path: '/teams', component: Page },
      { path: '/help', component: Page },
    ],
  })
  installPopupLinkGuard(router)
  const about = ref(false)
  const data = ref(false)
  const contact = ref(false)
  const whatsNew = ref(false)
  const ready = ref(false)
  const Root = defineComponent({
    setup() {
      const route = useRoute()
      watch(
        () => route.path,
        () => (about.value = false),
      )
      usePopupLink(
        {
          about: { shown: about, open: () => (about.value = true) },
          data: { shown: data, open: () => (data.value = true) },
          contact: { shown: contact, open: () => (contact.value = true) },
          whatsNew: { shown: whatsNew, open: () => (whatsNew.value = true) },
        },
        ready,
      )
      return () => h(RouterView)
    },
  })
  const app = createApp(Root)
  app.use(router)
  app.mount(document.createElement('div'))
  teardown = () => app.unmount()
  await router.isReady()
  ready.value = true
  await settle()
  return { router, about, data }
}

describe('usePopupLink', () => {
  it('opens the popup a link names and keeps the name out of the router', async () => {
    const { router, data } = await start('/teams?lang=zh&popup=data')
    expect(data.value).toBe(true)
    expect(address()).toBe('/teams?lang=zh&popup=data')
    expect(router.currentRoute.value.fullPath).toBe('/teams?lang=zh')
  })

  it.each(['/?popup=Data', '/?popup=data&popup=data', '/?popup='])('ignores %s', async (url) => {
    const { about, data } = await start(url)
    expect([about.value, data.value]).toEqual([false, false])
    expect(address()).toBe(url)
  })

  it('names an open popup in the address without a step for Back', async () => {
    const { about } = await start('/')
    const steps = history.length
    about.value = true
    await settle()
    expect(address()).toBe('/?popup=about')
    about.value = false
    await settle()
    expect(address()).toBe('/')
    expect(history.length).toBe(steps)
  })

  it('goes Back to the page a popup link left, without the popup', async () => {
    const { router, about } = await start('/')
    about.value = true
    await settle()
    // A link inside the popup: its navigation starts, then the popup closes.
    const followed = router.push('/help')
    about.value = false
    expect(await followed).toBeUndefined()
    await settle()
    expect(address()).toBe('/help')
    await goBack(router)
    expect(address()).toBe('/')
    expect(about.value).toBe(false)
  })

  it('adds no step for a link inside a popup to the page already open', async () => {
    const { router, about } = await start('/teams')
    about.value = true
    await settle()
    const steps = history.length
    void router.push('/teams')
    about.value = false
    await settle()
    expect(address()).toBe('/teams')
    expect(history.length).toBe(steps)
  })

  it('names a popup that stays open across a page change', async () => {
    const { router, data } = await start('/')
    data.value = true
    await settle()
    await router.push('/help')
    await settle()
    expect(address()).toBe('/help?popup=data')
    await goBack(router)
    expect(address()).toBe('/?popup=data')
    expect(data.value).toBe(true)
  })
})
