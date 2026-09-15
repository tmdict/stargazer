// @vitest-environment jsdom
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import { createHead } from '@unhead/vue/client'
import { afterEach, describe, expect, it } from 'vitest'

import { SITE_ORIGIN } from '@/lib/site'
import type { AppLocale } from '@/lib/types/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'

describe('setupGuideContentMeta', () => {
  let teardown: (() => void) | undefined

  afterEach(() => {
    teardown?.()
    teardown = undefined
  })

  it('follows the route locale reactively, as the en and zh guides share one instance', async () => {
    const head = createHead()
    const locale = ref<AppLocale>('en')
    const app = createApp(
      defineComponent({
        setup() {
          setupGuideContentMeta(locale)
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

    const resolved = async () => {
      const tags = await head.resolveTags()
      return {
        title: tags.find((tag) => tag.tag === 'title')?.textContent,
        canonical: tags.find((tag) => tag.tag === 'link' && tag.props.rel === 'canonical')?.props
          .href,
      }
    }

    expect(await resolved()).toEqual({
      title: 'Guide | Stargazer',
      canonical: `${SITE_ORIGIN}/en/guide`,
    })

    locale.value = 'zh'
    await nextTick()
    expect(await resolved()).toEqual({
      title: '机制 | Stargazer',
      canonical: `${SITE_ORIGIN}/zh/guide`,
    })
  })
})
