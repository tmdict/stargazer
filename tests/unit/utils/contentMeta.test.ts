// @vitest-environment jsdom
import { createApp, defineComponent, h, nextTick, ref, type Ref } from 'vue'
import { createHead } from '@unhead/vue/client'
import { afterEach, describe, expect, it } from 'vitest'

import type { GuidePage } from '@/lib/guide'
import { SITE_ORIGIN } from '@/lib/site'
import type { AppLocale } from '@/lib/types/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'

describe('setupGuideContentMeta', () => {
  let teardown: (() => void) | undefined

  afterEach(() => {
    teardown?.()
    teardown = undefined
  })

  // Mounts a component that sets the page's head and returns the resolved
  // title and canonical link.
  const mount = (locale: Ref<AppLocale>, page: GuidePage) => {
    const head = createHead()
    const app = createApp(
      defineComponent({
        setup() {
          setupGuideContentMeta(locale, page)
          return () => h('div')
        },
      }),
    )
    app.use(head)
    const host = document.createElement('div')
    document.body.append(host)
    app.mount(host)
    teardown = () => {
      app.unmount()
      host.remove()
    }
    return async () => {
      const tags = await head.resolveTags()
      return {
        title: tags.find((tag) => tag.tag === 'title')?.textContent,
        canonical: tags.find((tag) => tag.tag === 'link' && tag.props.rel === 'canonical')?.props
          .href,
      }
    }
  }

  it('follows the route locale reactively, as the en and zh guides share one instance', async () => {
    const locale = ref<AppLocale>('en')
    const resolved = mount(locale, 'index')

    expect(await resolved()).toEqual({
      title: 'Guide | Stargazer',
      canonical: `${SITE_ORIGIN}/en/guide`,
    })

    locale.value = 'zh'
    await nextTick()
    expect(await resolved()).toEqual({
      title: '指南 | Stargazer',
      canonical: `${SITE_ORIGIN}/zh/guide`,
    })
  })

  it('titles and links a sub-page by its own path', async () => {
    const resolved = mount(ref<AppLocale>('en'), 'mechanics')

    expect(await resolved()).toEqual({
      title: 'Mechanics | Stargazer',
      canonical: `${SITE_ORIGIN}/en/guide/mechanics`,
    })
  })
})
